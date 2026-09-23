/**
 * Order authorisation regression suite. Pinned so that a future wholesale
 * rewrite of the route file cannot silently reopen the hole: customers must
 * never see other customers' orders, and only admins may change status.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import {
  getApp,
  clearEmulator,
  registerUser,
  registerAdmin,
  putOrder,
  auth,
  type TestUser,
} from "../test/helpers.js";

let customerA: TestUser;
let customerB: TestUser;
let admin: TestUser;

beforeAll(async () => {
  await clearEmulator();
  customerA = await registerUser();
  customerB = await registerUser();
  admin = await registerAdmin();
  await putOrder("ORD-A1", customerA.userId);
  await putOrder("ORD-A2", customerA.userId, { status: "delivered" });
  await putOrder("ORD-B1", customerB.userId);
});

describe("GET /api/v1/orders", () => {
  it("customer A sees only A's orders", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/orders").set(auth(customerA.token));
    expect(res.status).toBe(200);
    const ids = res.body.data.orders.map((o: any) => o.orderId).sort();
    expect(ids).toEqual(["ORD-A1", "ORD-A2"]);
    expect(res.body.data.pagination.total).toBe(2);
  });

  it("customer cannot widen the scope with ?userId=", async () => {
    const app = await getApp();
    const res = await request(app)
      .get(`/api/v1/orders?userId=${customerB.userId}`)
      .set(auth(customerA.token));
    expect(res.status).toBe(200);
    expect(res.body.data.orders.every((o: any) => o.userId === customerA.userId)).toBe(true);
  });

  it("customer status filter applies within own orders", async () => {
    const app = await getApp();
    const res = await request(app)
      .get("/api/v1/orders?status=delivered")
      .set(auth(customerA.token));
    expect(res.body.data.orders.map((o: any) => o.orderId)).toEqual(["ORD-A2"]);
  });

  it("admin sees all orders and can filter by userId", async () => {
    const app = await getApp();
    const all = await request(app).get("/api/v1/orders").set(auth(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.data.pagination.total).toBe(3);

    const onlyB = await request(app)
      .get(`/api/v1/orders?userId=${customerB.userId}`)
      .set(auth(admin.token));
    expect(onlyB.body.data.orders.map((o: any) => o.orderId)).toEqual(["ORD-B1"]);
  });

  it("rejects unauthenticated requests", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/orders");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/orders/:orderId and cancel — ownership kept", () => {
  it("customer A gets 403 on B's order detail", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/orders/ORD-B1").set(auth(customerA.token));
    expect(res.status).toBe(403);
  });

  it("customer A gets 403 cancelling B's order", async () => {
    const app = await getApp();
    const res = await request(app).put("/api/v1/orders/ORD-B1/cancel").set(auth(customerA.token));
    expect(res.status).toBe(403);
  });

  it("admin can read any order", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/orders/ORD-B1").set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe("ORD-B1");
  });
});

describe("PUT /api/v1/orders/:orderId/status — admin only", () => {
  it("customer gets 403 even on their own order", async () => {
    const app = await getApp();
    const res = await request(app)
      .put("/api/v1/orders/ORD-A1/status")
      .set(auth(customerA.token))
      .send({ status: "processing" });
    expect(res.status).toBe(403);
  });

  it("admin update honours the transition table", async () => {
    const app = await getApp();
    const ok = await request(app)
      .put("/api/v1/orders/ORD-A1/status")
      .set(auth(admin.token))
      .send({ status: "processing" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("processing");

    const bad = await request(app)
      .put("/api/v1/orders/ORD-A2/status")
      .set(auth(admin.token))
      .send({ status: "pending" }); // delivered → pending is not allowed
    expect(bad.status).toBe(400);
  });
});
