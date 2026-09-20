/** T3.2 — cart add/update respect orderability; lines are kept and flagged. */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import {
  getApp,
  clearEmulator,
  seedCatalog,
  registerUser,
  registerAdmin,
  auth,
  type TestUser,
} from "../test/helpers.js";

let customer: TestUser;
let admin: TestUser;

beforeAll(async () => {
  await clearEmulator();
  await seedCatalog();
  customer = await registerUser();
  admin = await registerAdmin();
});

describe("POST /api/v1/cart/add", () => {
  it("rejects an inactive product with 422 LINE_NOT_ORDERABLE / INACTIVE", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/cart/add")
      .set(auth(customer.token))
      .send({ productId: "SEED-INACTIVE-GHEE", quantity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("LINE_NOT_ORDERABLE");
    expect(res.body.reason).toBe("INACTIVE");
  });

  it("rejects an unavailable product with reason UNAVAILABLE", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/cart/add")
      .set(auth(customer.token))
      .send({ productId: "SEED-UNAVAIL-PANEER", quantity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.reason).toBe("UNAVAILABLE");
  });

  it("allows a stock=0 product that is orderable per flags (D-013)", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/cart/add")
      .set(auth(customer.token))
      .send({ productId: "SEED-ZEROSTOCK-BESAN", quantity: 2 });
    expect(res.status).toBe(200);
    const line = res.body.data.items.find((i: any) => i.productId === "SEED-ZEROSTOCK-BESAN");
    expect(line).toMatchObject({ quantity: 2, isOrderable: true, minOrderExempt: false });
    expect(line.blocker).toBeUndefined();
  });

  it("lines carry minOrderExempt", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/cart/add")
      .set(auth(customer.token))
      .send({ productId: "SEED-SUGAR-1KG", quantity: 1 });
    const line = res.body.data.items.find((i: any) => i.productId === "SEED-SUGAR-1KG");
    expect(line.minOrderExempt).toBe(true);
  });
});

describe("existing line whose product flips", () => {
  it("is kept and flagged with a blocker, and quantity updates are refused", async () => {
    const app = await getApp();
    await request(app)
      .post("/api/v1/cart/add")
      .set(auth(customer.token))
      .send({ productId: "SEED-TEA-250G", quantity: 1 });

    await request(app)
      .put("/api/v1/products/SEED-TEA-250G")
      .set(auth(admin.token))
      .send({ isAvailable: false });

    const cart = await request(app).get("/api/v1/cart").set(auth(customer.token));
    const tea = cart.body.data.items.find((i: any) => i.productId === "SEED-TEA-250G");
    expect(tea).toBeDefined();
    expect(tea).toMatchObject({ isOrderable: false, blocker: "UNAVAILABLE" });

    const upd = await request(app)
      .put("/api/v1/cart/update/SEED-TEA-250G")
      .set(auth(customer.token))
      .send({ quantity: 3 });
    expect(upd.status).toBe(422);
    expect(upd.body.code).toBe("LINE_NOT_ORDERABLE");

    await request(app)
      .put("/api/v1/products/SEED-TEA-250G")
      .set(auth(admin.token))
      .send({ isAvailable: true });
  });
});
