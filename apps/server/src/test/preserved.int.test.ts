/**
 * SPEC §5 "already working and to be preserved". These pass on HEAD behaviour
 * and are re-run at the end of the phase.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import {
  getApp,
  clearEmulator,
  registerUser,
  login,
  putProduct,
  readDoc,
  auth,
  type TestUser,
} from "./helpers.js";

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  await clearEmulator();
  await putProduct("P-RICE", { name: "Rice 5kg", price: 320, stock: 10 });
  await putProduct("P-SALT", { name: "Salt 1kg", price: 25, stock: 10 });
  a = await registerUser();
  b = await registerUser();
});

describe("auth", () => {
  it("registration forces role=customer even when role:'admin' is sent", async () => {
    const u = await registerUser({ role: "admin" });
    const doc = await readDoc(`users/${u.userId}`);
    expect(doc?.role).toBe("customer");
  });

  it("login returns a JWT that authenticates", async () => {
    const app = await getApp();
    const token = await login(a.email, a.password);
    const res = await request(app).get("/api/v1/users/profile").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(a.userId);
  });

  it("cart and orders require a token", async () => {
    const app = await getApp();
    expect((await request(app).get("/api/v1/cart")).status).toBe(401);
    expect((await request(app).get("/api/v1/orders")).status).toBe(401);
    expect((await request(app).get("/api/v1/cart").set(auth("nope"))).status).toBe(401);
  });
});

describe("cart", () => {
  it("prices are server-authoritative: a client-supplied price is ignored", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/cart/add")
      .set(auth(a.token))
      .send({ productId: "P-RICE", quantity: 2, price: 1 });
    expect(res.status).toBe(200);
    const line = res.body.data.items.find((i: any) => i.productId === "P-RICE");
    expect(line.price).toBe(320);
    expect(res.body.data.totalAmount).toBe(640);
  });

  it("carts are isolated between users", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/cart").set(auth(b.token));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("the persisted cart survives re-login", async () => {
    const app = await getApp();
    const fresh = await login(a.email, a.password);
    const res = await request(app).get("/api/v1/cart").set(auth(fresh));
    expect(res.body.data.items.map((i: any) => i.productId)).toEqual(["P-RICE"]);
    expect(res.body.data.totalItems).toBe(2);
  });
});
