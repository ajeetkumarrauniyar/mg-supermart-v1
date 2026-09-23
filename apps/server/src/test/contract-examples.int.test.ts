/**
 * Produces the request/response examples embedded in docs/API-CONTRACT-M1.md
 * from real emulator runs, so the documentation cannot drift from the API.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { writeFileSync } from "fs";
import { join } from "path";
import {
  getApp,
  clearEmulator,
  seedCatalog,
  registerUser,
  fillCart,
  saveAddress,
  auth,
} from "./helpers.js";
import { destinationPoint } from "../domain/geo.js";
import { STORE } from "../test/fixtures.js";

const near = destinationPoint(STORE, 2, 10);
const far = destinationPoint(STORE, 7, 250);

/** Normalises volatile values so the examples are stable across runs. */
const stable = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === "createdAt" || k === "updatedAt") out[k] = "2026-09-20T10:00:00.000Z";
      else if (k === "addedAt") out[k] = "2026-09-20T10:00:00.000Z";
      else if (k === "orderId") out[k] = "ORDER_ID";
      else if (k === "addressId") out[k] = val === null ? null : "ADDRESS_ID";
      else if (k === "userId") out[k] = "USER_ID";
      else if (k === "idempotencyKey") out[k] = "client-generated-uuid";
      else if (k === "token") out[k] = "JWT";
      else if (k === "lat" || k === "lng") out[k] = Number((val as number).toFixed(6));
      else out[k] = stable(val);
    }
    return out;
  }
  return v;
};

const examples: Record<string, unknown> = {};

beforeAll(async () => {
  await clearEmulator();
  await seedCatalog();
});

describe("contract examples", () => {
  it("captures address, quote, order, cart and product examples", async () => {
    const app = await getApp();
    const u = await registerUser();

    const addr = await request(app).post("/api/v1/addresses").set(auth(u.token)).send({
      label: "Home",
      recipientName: "Sita Devi",
      phone: "9876543210",
      line1: "Ward 4, near Shiv Mandir",
      landmark: "Opp. primary school",
      area: "Pipra Bazar",
      pincode: "845416",
      lat: near.lat,
      lng: near.lng,
      accuracyM: 12,
    });
    expect(addr.status).toBe(201);
    examples["POST /api/v1/addresses → 201"] = stable(addr.body);
    const addressId = addr.body.data.addressId as string;

    const farAddr = await request(app).post("/api/v1/addresses").set(auth(u.token)).send({
      label: "Farm", recipientName: "Sita Devi", phone: "9876543210", line1: "Khet road", area: "Bariarpur",
      lat: far.lat, lng: far.lng,
    });
    examples["POST /api/v1/addresses (7 km away) → 201"] = stable(farAddr.body);

    const bad = await request(app).post("/api/v1/addresses").set(auth(u.token)).send({ label: "x" });
    examples["POST /api/v1/addresses (missing fields) → 400"] = stable(bad.body);

    const list = await request(app).get("/api/v1/addresses").set(auth(u.token));
    examples["GET /api/v1/addresses → 200"] = stable(list.body);

    await fillCart(u.token, [["SEED-RICE-5KG", 1], ["SEED-OIL-MUSTARD-1L", 1]]);
    const cart = await request(app).get("/api/v1/cart").set(auth(u.token));
    examples["GET /api/v1/cart → 200"] = stable(cart.body);

    const blocked = await request(app).post("/api/v1/cart/add").set(auth(u.token)).send({ productId: "SEED-UNAVAIL-PANEER", quantity: 1 });
    examples["POST /api/v1/cart/add (not orderable) → 422"] = stable(blocked.body);

    const qBelow = await request(app).post("/api/v1/cart/quote").set(auth(u.token)).send({ addressId });
    examples["POST /api/v1/cart/quote (below minimum) → 200"] = stable(qBelow.body);

    const qFar = await request(app).post("/api/v1/cart/quote").set(auth(u.token)).send({ addressId: farAddr.body.data.addressId });
    examples["POST /api/v1/cart/quote (unserviceable address) → 200"] = stable(qFar.body);

    await fillCart(u.token, [["SEED-ATTA-5KG", 1]]);
    const qOk = await request(app).post("/api/v1/cart/quote").set(auth(u.token)).send({ addressId });
    expect(qOk.body.data.orderable).toBe(true);
    examples["POST /api/v1/cart/quote (orderable) → 200"] = stable(qOk.body);

    const noKey = await request(app).post("/api/v1/orders").set(auth(u.token)).send({ addressId, paymentMethod: "COD" });
    examples["POST /api/v1/orders (missing idempotencyKey) → 400"] = stable(noKey.body);

    const order = await request(app).post("/api/v1/orders").set(auth(u.token)).send({ addressId, paymentMethod: "COD", idempotencyKey: "k1" });
    expect(order.status).toBe(201);
    examples["POST /api/v1/orders → 201"] = stable(order.body);

    const replay = await request(app).post("/api/v1/orders").set(auth(u.token)).send({ addressId, paymentMethod: "COD", idempotencyKey: "k1" });
    expect(replay.status).toBe(200);
    examples["POST /api/v1/orders (replay, same key) → 200"] = { success: replay.body.success, message: replay.body.message, replayed: replay.body.replayed, data: "…the original order…" };

    const empty = await request(app).post("/api/v1/orders").set(auth(u.token)).send({ addressId, paymentMethod: "COD", idempotencyKey: "k2" });
    expect(empty.status).toBe(422);
    examples["POST /api/v1/orders (blocked) → 422"] = stable(empty.body);

    const mine = await request(app).get("/api/v1/orders").set(auth(u.token));
    examples["GET /api/v1/orders (customer) → 200"] = { ...mine.body, data: { ...mine.body.data, orders: "…[order] as above…" } };

    const product = await request(app).get("/api/v1/products/SEED-SUGAR-1KG");
    examples["GET /api/v1/products/:id → 200"] = stable(product.body);

    const inactive = await request(app).get("/api/v1/products/SEED-INACTIVE-GHEE");
    examples["GET /api/v1/products/:id (inactive, customer) → 404"] = stable(inactive.body);

    const out = join(process.cwd(), "docs", "api-contract-m1.examples.json");
    writeFileSync(out, JSON.stringify(examples, null, 2) + "\n");
    expect(Object.keys(examples).length).toBeGreaterThan(10);
  });
});
