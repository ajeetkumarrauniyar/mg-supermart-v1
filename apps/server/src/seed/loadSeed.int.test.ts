import { describe, it, expect, beforeAll } from "vitest";
import { clearEmulator, seedCatalog, hashSeedProducts, readDoc, listDocs } from "../test/helpers.js";

describe("seed loader", () => {
  beforeAll(async () => {
    await clearEmulator();
  });

  it("loads the catalog, and running it twice yields the identical document set", async () => {
    const first = await seedCatalog();
    expect(first.result.products).toBeGreaterThanOrEqual(24);
    const h1 = await hashSeedProducts();

    const second = await seedCatalog();
    expect(second.result.products).toBe(first.result.products);
    const h2 = await hashSeedProducts();
    expect(h2).toBe(h1);

    const third = await seedCatalog({ reset: true });
    expect(third.result.deleted).toBe(first.result.products);
    expect(await hashSeedProducts()).toBe(h1);
  });

  it("contains the required catalogue fixtures", async () => {
    const { catalog } = await seedCatalog();
    const byId = Object.fromEntries(catalog.products.map((p) => [p.productId, p]));
    const exempt = catalog.products.filter((p) => p.minOrderExempt).map((p) => p.productId).sort();
    expect(exempt).toEqual(["SEED-MILK-1L", "SEED-OIL-MUSTARD-1L", "SEED-OIL-REFINED-1L", "SEED-SUGAR-1KG"]);
    expect(byId["SEED-INACTIVE-GHEE"]?.isActive).toBe(false);
    expect(byId["SEED-UNAVAIL-PANEER"]?.isAvailable).toBe(false);
    expect(byId["SEED-ZEROSTOCK-BESAN"]).toMatchObject({ stock: 0, isActive: true, isAvailable: true });
    expect(byId["SEED-MILK-1L"]).toMatchObject({ stock: 0, minOrderExempt: true });
    expect(byId["SEED-NOFLAGS-MAGGI"]?.isActive).toBeUndefined();
    // ₹499 / ₹500 / ₹501 eligible reachable in ≤ 3 lines
    expect(byId["SEED-RICE-5KG"]!.price + byId["SEED-ATTA-5KG"]!.price).toBe(500);
    expect(byId["SEED-RICE-5KG"]!.price + byId["SEED-DAL-CHANA-1KG"]!.price).toBe(499);
    expect(byId["SEED-RICE-5KG"]!.price + byId["SEED-DAL-MOONG-1KG"]!.price).toBe(501);
  });

  it("seeds an admin user and never writes isOrderable", async () => {
    await seedCatalog();
    const admin = await readDoc("users/SEED-ADMIN");
    expect(admin?.role).toBe("admin");
    expect(admin?.email).toBe("seed-admin@mg.test");
    const products = await listDocs("products");
    expect(products.some((p) => "isOrderable" in p)).toBe(false);
  });
});
