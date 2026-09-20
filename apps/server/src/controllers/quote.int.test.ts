/** T5.1 — POST /cart/quote on the seed catalog (D-012 §6, D-014 §4). */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import {
  getApp,
  clearEmulator,
  seedCatalog,
  registerUser,
  registerAdmin,
  fillCart,
  saveAddress,
  auth,
  type TestUser,
} from "../test/helpers.js";
import { destinationPoint } from "../domain/geo.js";
import { STORE } from "../test/fixtures.js";
import { resetStoreConfigCache } from "../config/storeConfig.js";

let admin: TestUser;
const near = destinationPoint(STORE, 2, 10);
const far = destinationPoint(STORE, 7, 250);

beforeAll(async () => {
  await clearEmulator();
  await seedCatalog();
  admin = await registerAdmin();
});

afterEach(() => {
  process.env.DELIVERY_FEE_WAIVED_AT = "";
  resetStoreConfigCache();
});

const quote = async (token: string, body: Record<string, unknown> = {}) => {
  const app = await getApp();
  return request(app).post("/api/v1/cart/quote").set(auth(token)).send(body);
};

describe("POST /api/v1/cart/quote", () => {
  it("exempt-only cart: subtotal ≥ 500 but ORDER_BELOW_MINIMUM; bill still populated", async () => {
    const u = await registerUser();
    await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-OIL-MUSTARD-1L", 3], ["SEED-SUGAR-1KG", 1]]); // 540 + 45
    const res = await quote(u.token);
    expect(res.status).toBe(200);
    const { bill, serviceability, orderable, blockers } = res.body.data;
    expect(serviceability.status).toBe("serviceable");
    expect(bill.subtotal).toBe(585);
    expect(bill.eligibleAmount).toBe(0);
    expect(bill.shortfall).toBe(500);
    expect(bill.total).toBe(585 + 40 + 5);
    expect(orderable).toBe(false);
    expect(blockers.map((b: any) => b.code)).toEqual(["ORDER_BELOW_MINIMUM"]);
    expect(bill.lines.find((l: any) => l.productId === "SEED-SUGAR-1KG").minOrderExempt).toBe(true);
  });

  it("happy path: default address used when none given; orderable with no blockers", async () => {
    const u = await registerUser();
    const addressId = await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 1], ["SEED-ATTA-5KG", 1]]); // exactly 500
    const res = await quote(u.token);
    expect(res.body.data.addressId).toBe(addressId);
    expect(res.body.data.orderable).toBe(true);
    expect(res.body.data.blockers).toEqual([]);
    expect(res.body.data.bill).toMatchObject({
      subtotal: 500,
      eligibleAmount: 500,
      minOrderMet: true,
      deliveryFee: 40,
      handlingFee: 5,
      total: 545,
      appliedConfig: { minOrderValue: 500, deliveryRadiusKm: 5 },
    });
  });

  it("out-of-radius address ⇒ ADDRESS_NOT_SERVICEABLE with distance, bill still computed", async () => {
    const u = await registerUser();
    const farId = await saveAddress(u.token, far, { label: "Farm" });
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
    const res = await quote(u.token, { addressId: farId });
    expect(res.status).toBe(200);
    expect(res.body.data.serviceability).toMatchObject({ status: "not_serviceable", reason: "OUTSIDE_RADIUS" });
    expect(res.body.data.blockers).toEqual([
      expect.objectContaining({ code: "ADDRESS_NOT_SERVICEABLE", radiusKm: 5 }),
    ]);
    expect(res.body.data.blockers[0].distanceKm).toBeCloseTo(7, 1);
    expect(res.body.data.bill.total).toBe(640 + 45);
  });

  it("no address at all ⇒ unknown + ADDRESS_REQUIRED (200, a report not an error)", async () => {
    const u = await registerUser();
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
    const res = await quote(u.token);
    expect(res.status).toBe(200);
    expect(res.body.data.addressId).toBeNull();
    expect(res.body.data.serviceability.status).toBe("unknown");
    expect(res.body.data.blockers.map((b: any) => b.code)).toEqual(["ADDRESS_REQUIRED"]);
  });

  it("someone else's addressId ⇒ 403 ADDRESS_NOT_OWNED", async () => {
    const owner = await registerUser();
    const otherId = await saveAddress(owner.token, near);
    const u = await registerUser();
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]);
    const res = await quote(u.token, { addressId: otherId });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADDRESS_NOT_OWNED");
  });

  it("a line that became inactive ⇒ LINE_NOT_ORDERABLE / INACTIVE, line kept", async () => {
    const app = await getApp();
    const u = await registerUser();
    await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2], ["SEED-BISCUIT-PACK", 1]]);
    await request(app).put("/api/v1/products/SEED-BISCUIT-PACK").set(auth(admin.token)).send({ isActive: false });
    const res = await quote(u.token);
    expect(res.body.data.blockers).toEqual([
      expect.objectContaining({ code: "LINE_NOT_ORDERABLE", productId: "SEED-BISCUIT-PACK", reason: "INACTIVE" }),
    ]);
    expect(res.body.data.bill.lines).toHaveLength(2);
    await request(app).put("/api/v1/products/SEED-BISCUIT-PACK").set(auth(admin.token)).send({ isActive: true });
  });

  it("empty cart ⇒ CART_EMPTY", async () => {
    const u = await registerUser();
    await saveAddress(u.token, near);
    const res = await quote(u.token);
    expect(res.body.data.blockers.map((b: any) => b.code)).toEqual(["CART_EMPTY"]);
  });

  it("fee waiver honoured when the env threshold is set", async () => {
    const u = await registerUser();
    await saveAddress(u.token, near);
    await fillCart(u.token, [["SEED-RICE-5KG", 2]]); // 640
    process.env.DELIVERY_FEE_WAIVED_AT = "600";
    resetStoreConfigCache();
    const res = await quote(u.token);
    expect(res.body.data.bill.deliveryFee).toBe(0);
    expect(res.body.data.bill.handlingFee).toBe(5);
    expect(res.body.data.bill.total).toBe(645);
    expect(res.body.data.bill.appliedConfig.deliveryFee).toEqual({ amount: 40, waivedAtOrAbove: 600 });
  });
});
