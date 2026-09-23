/** Transactional, idempotent order creation. */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { execSync } from "child_process";
import { join } from "path";
import {
  getApp,
  clearEmulator,
  seedCatalog,
  registerUser,
  registerAdmin,
  fillCart,
  saveAddress,
  readDoc,
  listDocs,
  auth,
  type TestUser,
} from "../test/helpers.js";
import { destinationPoint } from "../domain/geo.js";
import { STORE } from "../test/fixtures.js";

let admin: TestUser;
const near = destinationPoint(STORE, 2, 10);
const far = destinationPoint(STORE, 7, 250);

let keySeq = 0;
const key = () => `key-${Date.now()}-${++keySeq}`;

beforeAll(async () => {
  await clearEmulator();
  await seedCatalog();
  admin = await registerAdmin();
});

const place = async (token: string, body: Record<string, unknown>) => {
  const app = await getApp();
  return request(app).post("/api/v1/orders").set(auth(token)).send(body);
};

describe("POST /api/v1/orders", () => {
  it("happy path persists bill/appliedConfig/snapshot, clears the cart, and equals the quote", async () => {
    const app = await getApp();
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 1], ["SEED-DAL-MOONG-1KG", 1], ["SEED-SUGAR-1KG", 2]]); // 320+181+90

    const q = await request(app).post("/api/v1/cart/quote").set(auth(u.token)).send({ addressId });
    expect(q.body.data.orderable).toBe(true);

    const res = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: key() });
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.status).toBe("pending");
    expect(order.paymentStatus).toBe("pending");
    expect(order.paymentDetails).toEqual({ paymentMethod: "COD" });
    expect(order.bill).toEqual(q.body.data.bill);
    expect(order.appliedConfig).toEqual(q.body.data.bill.appliedConfig);
    expect(order.totalAmount).toBe(order.bill.total);
    expect(order.totalAmount).toBe(591 + 45);
    expect(order.addressSnapshot).toMatchObject({
      addressId,
      line1: "Ward 4, near Shiv Mandir",
      area: "Pipra Bazar",
      pincode: "845416",
      radiusKm: 5,
    });
    expect(order.addressSnapshot.distanceKm).toBeCloseTo(2, 1);
    expect(order.items).toHaveLength(3);
    expect(order.items.find((i: any) => i.productId === "SEED-SUGAR-1KG")).toMatchObject({
      price: 45,
      unitPrice: 45,
      quantity: 2,
      lineTotal: 90,
      minOrderExempt: true,
    });

    const cart = await request(app).get("/api/v1/cart").set(auth(u.token));
    expect(cart.body.data.items).toEqual([]);

    // stock untouched
    expect((await readDoc("products/SEED-RICE-5KG"))?.stock).toBe(40);

    // idempotency record written in the same transaction
    const rec = await readDoc(`users/${u.userId}/orderIdempotency/${order.idempotencyKey}`);
    expect(rec?.orderId).toBe(order.orderId);

    // the customer can read it back; another customer cannot
    expect((await request(app).get(`/api/v1/orders/${order.orderId}`).set(auth(u.token))).status).toBe(200);
    const other = await registerUser();
    expect((await request(app).get(`/api/v1/orders/${order.orderId}`).set(auth(other.token))).status).toBe(403);
  });

  it("admin-panel shape: shippingAddress.{street,city,state,zipCode}, totalAmount, items[].price", async () => {
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
    const res = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: key() });
    expect(res.status).toBe(201);
    expect(res.body.data.shippingAddress).toEqual({
      street: "Ward 4, near Shiv Mandir, Opp. primary school",
      city: "Pipra Bazar",
      state: process.env.LEGACY_SHIPPING_STATE, // compat value from env, never a literal in src/
      zipCode: "845416",
    });
    expect(typeof res.body.data.totalAmount).toBe("number");
    expect(res.body.data.items[0].price).toBe(320);

    // grep assertion: the compat value never appears as a literal under src/
    const srcDir = join(process.cwd(), "src");
    const out = execSync(
      `grep -rniI "${process.env.LEGACY_SHIPPING_STATE}" "${srcDir}" --exclude="*.test.ts" --exclude="setup.ts" || true`
    ).toString();
    expect(out.trim()).toBe("");
  });

  it("state is empty when LEGACY_SHIPPING_STATE is unset", async () => {
    const { resetLegacyCompatCache } = await import("../config/legacyCompat.js");
    const saved = process.env.LEGACY_SHIPPING_STATE;
    delete process.env.LEGACY_SHIPPING_STATE;
    resetLegacyCompatCache();
    try {
      const u = await registerUser();
      const addressId = await saveAddress(u.token, near, { landmark: undefined, pincode: undefined });
      await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
      const res = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: key() });
      expect(res.status).toBe(201);
      expect(res.body.data.shippingAddress).toEqual({
        street: "Ward 4, near Shiv Mandir",
        city: "Pipra Bazar",
        state: "",
        zipCode: "",
      });
    } finally {
      process.env.LEGACY_SHIPPING_STATE = saved;
      resetLegacyCompatCache();
    }
  });

  it("replay with the same key returns the original order (200, replayed:true) without a second write", async () => {
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
    const k = key();
    const first = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: k });
    expect(first.status).toBe(201);
    const again = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: k });
    expect(again.status).toBe(200);
    expect(again.body.replayed).toBe(true);
    expect(again.body.data.orderId).toBe(first.body.data.orderId);
    const mine = (await listDocs("orders")).filter((o) => o.userId === u.userId);
    expect(mine).toHaveLength(1);
  });

  it("concurrency: 10 identical submits (same key) ⇒ exactly one order, all responses reference it", async () => {
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
    const k = key();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: k }))
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 200)).toHaveLength(9);
    const ids = new Set(results.map((r) => r.body.data.orderId));
    expect(ids.size).toBe(1);
    const mine = (await listDocs("orders")).filter((o) => o.userId === u.userId);
    expect(mine).toHaveLength(1);
  });

  it("concurrency: 10 submits with different keys on the same cart ⇒ one 201, the rest 422 CART_EMPTY", async () => {
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: key() }))
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 422);
    expect(rejected).toHaveLength(9);
    expect(rejected.every((r) => r.body.code === "CART_EMPTY")).toBe(true);
    const mine = (await listDocs("orders")).filter((o) => o.userId === u.userId);
    expect(mine).toHaveLength(1);
  });

  it("address flipped out of radius between quote and order ⇒ 422 ADDRESS_NOT_SERVICEABLE", async () => {
    const app = await getApp();
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
    const q = await request(app).post("/api/v1/cart/quote").set(auth(u.token)).send({ addressId });
    expect(q.body.data.orderable).toBe(true);

    const upd = await request(app)
      .put(`/api/v1/addresses/${addressId}`)
      .set(auth(u.token))
      .send({ label: "Home", recipientName: "Sita Devi", phone: "9876543210", line1: "x", area: "y", lat: far.lat, lng: far.lng });
    expect(upd.status).toBe(200);

    const res = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: key() });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ADDRESS_NOT_SERVICEABLE");
    expect(res.body.blockers[0].distanceKm).toBeCloseTo(7, 1);
    // nothing written, cart intact
    const cart = await request(app).get("/api/v1/cart").set(auth(u.token));
    expect(cart.body.data.items).toHaveLength(1);
  });

  it("product deactivated between quote and order ⇒ 422 LINE_NOT_ORDERABLE with blockers[]", async () => {
    const app = await getApp();
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2], ["SEED-TEA-250G", 1]]);
    await request(app).put("/api/v1/products/SEED-TEA-250G").set(auth(admin.token)).send({ isAvailable: false });
    const res = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: key() });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("LINE_NOT_ORDERABLE");
    expect(res.body.blockers).toEqual([
      expect.objectContaining({ code: "LINE_NOT_ORDERABLE", productId: "SEED-TEA-250G", reason: "UNAVAILABLE" }),
    ]);
    await request(app).put("/api/v1/products/SEED-TEA-250G").set(auth(admin.token)).send({ isAvailable: true });
  });

  it("below minimum ⇒ 422 ORDER_BELOW_MINIMUM", async () => {
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 1], ["SEED-DAL-CHANA-1KG", 1]]); // 499
    const res = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: key() });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ORDER_BELOW_MINIMUM");
    expect(res.body.blockers[0].shortfall).toBe(1);
  });

  it("validation: missing key ⇒ 400 IDEMPOTENCY_KEY_REQUIRED; Online ⇒ 400; missing addressId ⇒ 400; foreign addressId ⇒ 403", async () => {
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);

    const noKey = await place(u.token, { addressId, paymentMethod: "COD" });
    expect(noKey.status).toBe(400);
    expect(noKey.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");

    const online = await place(u.token, { addressId, paymentMethod: "Online", idempotencyKey: key() });
    expect(online.status).toBe(400);
    expect(online.body.field).toBe("paymentMethod");

    const noAddr = await place(u.token, { paymentMethod: "COD", idempotencyKey: key() });
    expect(noAddr.status).toBe(400);
    expect(noAddr.body.field).toBe("addressId");

    const owner = await registerUser();
    const foreign = await saveAddress(owner.token, near);
    const notOwned = await place(u.token, { addressId: foreign, paymentMethod: "COD", idempotencyKey: key() });
    expect(notOwned.status).toBe(403);
    expect(notOwned.body.code).toBe("ADDRESS_NOT_OWNED");
  });

  it("malformed ids never reach Firestore: 400 VALIDATION_ERROR, no stray documents", async () => {
    const app = await getApp();
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
    for (const idempotencyKey of ["..", "a/b/c", "__x__", "a/b"]) {
      const r = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe("VALIDATION_ERROR");
      expect(r.body.field).toBe("idempotencyKey");
    }
    for (const bad of ["..", "a/b", "__x__"]) {
      const q = await request(app).post("/api/v1/cart/quote").set(auth(u.token)).send({ addressId: bad });
      expect(q.status).toBe(400);
      expect(q.body.field).toBe("addressId");
      const o = await place(u.token, { addressId: bad, paymentMethod: "COD", idempotencyKey: key() });
      expect(o.status).toBe(400);
    }
    // path params ("/addresses/.." is normalised away by Express before routing, so probe the others)
    for (const bad of ["a%2Fb", "__x__"]) {
      const d = await request(app).delete(`/api/v1/addresses/${bad}`).set(auth(u.token));
      expect(d.status).toBe(400);
      expect(d.body.field).toBe("addressId");
    }
    expect(await listDocs(`users/${u.userId}/orderIdempotency/a/b`)).toEqual([]);
    const cart = await request(app).get("/api/v1/cart").set(auth(u.token));
    expect(cart.body.data.items).toHaveLength(1);
  });

  it("cancel keeps ownership rules and does not touch stock", async () => {
    const app = await getApp();
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-ATTA-5KG", 3]]);
    const res = await place(u.token, { addressId, paymentMethod: "COD", idempotencyKey: key() });
    const stockBefore = (await readDoc("products/SEED-ATTA-5KG"))?.stock;
    const cancel = await request(app).put(`/api/v1/orders/${res.body.data.orderId}/cancel`).set(auth(u.token));
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe("cancelled");
    expect((await readDoc("products/SEED-ATTA-5KG"))?.stock).toBe(stockBefore);
  });
});
