/** T5.3 — canonical /cart/items/:id routes plus deprecated aliases, /cart/count. */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getApp, clearEmulator, seedCatalog, registerUser, fillCart, auth, type TestUser } from "../test/helpers.js";

let u: TestUser;

beforeAll(async () => {
  await clearEmulator();
  await seedCatalog();
  u = await registerUser();
  await fillCart(u.token, [["SEED-RICE-5KG", 1], ["SEED-ATTA-5KG", 1], ["SEED-SALT-1KG", 1]]);
});

describe("cart routes", () => {
  it("PUT /cart/items/:id (canonical) and PUT /cart/update/:id (alias) both update", async () => {
    const app = await getApp();
    const a = await request(app).put("/api/v1/cart/items/SEED-RICE-5KG").set(auth(u.token)).send({ quantity: 2 });
    expect(a.status).toBe(200);
    expect(a.body.data.items.find((i: any) => i.productId === "SEED-RICE-5KG").quantity).toBe(2);
    const b = await request(app).put("/api/v1/cart/update/SEED-RICE-5KG").set(auth(u.token)).send({ quantity: 3 });
    expect(b.status).toBe(200);
    expect(b.body.data.items.find((i: any) => i.productId === "SEED-RICE-5KG").quantity).toBe(3);
  });

  it("GET /cart/count sums quantities", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/cart/count").set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.data.itemCount).toBe(5);
  });

  it("DELETE /cart/items/:id (canonical) and DELETE /cart/remove/:id (alias) both remove", async () => {
    const app = await getApp();
    expect((await request(app).delete("/api/v1/cart/items/SEED-SALT-1KG").set(auth(u.token))).status).toBe(200);
    expect((await request(app).delete("/api/v1/cart/remove/SEED-ATTA-5KG").set(auth(u.token))).status).toBe(200);
    const cart = await request(app).get("/api/v1/cart").set(auth(u.token));
    expect(cart.body.data.items.map((i: any) => i.productId)).toEqual(["SEED-RICE-5KG"]);
  });

  it("validateCart is no longer routed (superseded by quote)", async () => {
    const app = await getApp();
    expect((await request(app).post("/api/v1/cart/validate").set(auth(u.token))).status).toBe(404);
  });
});
