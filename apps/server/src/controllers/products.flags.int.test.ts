/** Product flags, derived isOrderable, and customer/admin visibility. */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import {
  getApp,
  clearEmulator,
  seedCatalog,
  registerUser,
  registerAdmin,
  putProduct,
  readDoc,
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
  // A document from before the flags existed (no fields at all)
  await putProduct("LEGACY-NOFLAGS", { name: "Legacy product" });
});

describe("GET /api/v1/products", () => {
  it("customer listing excludes isActive=false and treats missing fields as visible", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/products?limit=100");
    expect(res.status).toBe(200);
    const ids = res.body.data.products.map((p: any) => p.productId);
    expect(ids).not.toContain("SEED-INACTIVE-GHEE");
    expect(ids).toContain("SEED-UNAVAIL-PANEER"); // visible, not orderable
    expect(ids).toContain("SEED-NOFLAGS-MAGGI");
    expect(ids).toContain("LEGACY-NOFLAGS");
    expect(ids).toContain("SEED-ZEROSTOCK-BESAN"); // stock is informational
  });

  it("every product carries the flags and the derived isOrderable", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/products?limit=100");
    const byId = Object.fromEntries(res.body.data.products.map((p: any) => [p.productId, p]));
    expect(byId["LEGACY-NOFLAGS"]).toMatchObject({
      isActive: true,
      isAvailable: true,
      minOrderExempt: false,
      isOrderable: true,
    });
    expect(byId["SEED-UNAVAIL-PANEER"]).toMatchObject({ isAvailable: false, isOrderable: false });
    expect(byId["SEED-SUGAR-1KG"]).toMatchObject({ minOrderExempt: true, isOrderable: true });
    expect(byId["SEED-ZEROSTOCK-BESAN"]).toMatchObject({ stock: 0, isOrderable: true });
    expect(byId["SEED-RICE-5KG"].mrp).toBe(340);
  });

  it("inStock=true is re-mapped to isOrderable", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/products?limit=100&inStock=true");
    const ids = res.body.data.products.map((p: any) => p.productId);
    expect(ids).not.toContain("SEED-UNAVAIL-PANEER");
    expect(ids).toContain("SEED-ZEROSTOCK-BESAN");
  });

  it("includeInactive=1 is admin-only and shows inactive products", async () => {
    const app = await getApp();
    const anon = await request(app).get("/api/v1/products?includeInactive=1");
    expect(anon.status).toBe(403);
    const cust = await request(app).get("/api/v1/products?includeInactive=1").set(auth(customer.token));
    expect(cust.status).toBe(403);
    const adm = await request(app)
      .get("/api/v1/products?includeInactive=1&limit=100")
      .set(auth(admin.token));
    expect(adm.status).toBe(200);
    expect(adm.body.data.products.map((p: any) => p.productId)).toContain("SEED-INACTIVE-GHEE");
  });
});

describe("GET /api/v1/products/:id", () => {
  it("inactive product is 404 for customers and anonymous, visible to admin", async () => {
    const app = await getApp();
    expect((await request(app).get("/api/v1/products/SEED-INACTIVE-GHEE")).status).toBe(404);
    expect(
      (await request(app).get("/api/v1/products/SEED-INACTIVE-GHEE").set(auth(customer.token))).status
    ).toBe(404);
    const adm = await request(app).get("/api/v1/products/SEED-INACTIVE-GHEE").set(auth(admin.token));
    expect(adm.status).toBe(200);
    expect(adm.body.data.isOrderable).toBe(false);
  });
});

describe("GET /api/v1/products/:id — malformed ids never expose datastore internals", () => {
  it("a normal nonexistent id still returns a controlled 404 NOT_FOUND", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/products/does-not-exist-123");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: "Product not found", field: undefined, code: "NOT_FOUND" });
  });

  it.each(["__x__", "a%2Fb", "__name__"])(
    "reserved/malformed id %s → 400 VALIDATION_ERROR, no datastore internals",
    async (bad) => {
      const app = await getApp();
      const res = await request(app).get(`/api/v1/products/${bad}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.field).toBe("productId");
      const serialised = JSON.stringify(res.body);
      expect(serialised).not.toContain("INVALID_ARGUMENT");
      expect(serialised).not.toContain("reserved");
      expect(res.body["0"]).toBeUndefined();
      expect(typeof res.body.code).toBe("string");
    }
  );

  it("a valid existing id still returns 200", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/products/SEED-RICE-5KG");
    expect(res.status).toBe(200);
    expect(res.body.data.productId).toBe("SEED-RICE-5KG");
  });
});

describe("PUT /api/v1/products/:id (admin)", () => {
  it("flips the three flags; the response derives isOrderable; nothing else changes", async () => {
    const app = await getApp();
    const before = await readDoc("products/SEED-TEA-250G");
    const res = await request(app)
      .put("/api/v1/products/SEED-TEA-250G")
      .set(auth(admin.token))
      .send({ isAvailable: false, minOrderExempt: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      isActive: true,
      isAvailable: false,
      minOrderExempt: true,
      isOrderable: false,
    });
    const after = await readDoc("products/SEED-TEA-250G");
    expect(after?.isAvailable).toBe(false);
    expect(after?.minOrderExempt).toBe(true);
    expect(after?.price).toBe(before?.price);
    expect(after?.stock).toBe(before?.stock);
    expect("isOrderable" in (after ?? {})).toBe(false);

    // restore
    await request(app)
      .put("/api/v1/products/SEED-TEA-250G")
      .set(auth(admin.token))
      .send({ isAvailable: true, minOrderExempt: false });
  });

  it("rejects non-boolean flags with VALIDATION_ERROR naming the field", async () => {
    const app = await getApp();
    const res = await request(app)
      .put("/api/v1/products/SEED-TEA-250G")
      .set(auth(admin.token))
      .send({ isActive: "false" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.field).toBe("isActive");
  });

  it("customers cannot update products", async () => {
    const app = await getApp();
    const res = await request(app)
      .put("/api/v1/products/SEED-TEA-250G")
      .set(auth(customer.token))
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });
});
