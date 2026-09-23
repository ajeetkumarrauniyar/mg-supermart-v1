/**
 * Seed catalog loader.
 *
 * - Reads seed/catalog.v1.json (versioned in the repo).
 * - Writes each product with `set` (no merge) so a re-run yields the exact
 *   same document set; timestamps are fixed per product, not "now".
 * - `reset` deletes every existing SEED-* product first.
 * - Seeds one admin user for E2E (fixed id/email; password is bcrypt-hashed).
 * - Only ever touches SEED-* product ids and the seed admin user.
 *
 * The target check lives in seedGuard.ts; callers (CLI, tests) run it first.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcrypt";
import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "../services/firebase.js";

export const SEED_PREFIX = "SEED-";

export interface SeedProduct {
  productId: string;
  name: string;
  description: string;
  price: number;
  mrp?: number;
  stock: number;
  category: string;
  unit: string;
  isActive?: boolean;
  isAvailable?: boolean;
  minOrderExempt?: boolean;
}

export interface SeedCatalog {
  version: number;
  description: string;
  admin: { userId: string; email: string; password: string; name: string; phoneNumber: string };
  products: SeedProduct[];
}

export const SEED_CATALOG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "seed",
  "catalog.v1.json"
);

export const readSeedCatalog = (path: string = SEED_CATALOG_PATH): SeedCatalog => {
  const catalog = JSON.parse(readFileSync(path, "utf8")) as SeedCatalog;
  for (const p of catalog.products) {
    if (!p.productId.startsWith(SEED_PREFIX)) {
      throw new Error(`Seed product id must start with ${SEED_PREFIX}: ${p.productId}`);
    }
  }
  return catalog;
};

/** Fixed base time so createdAt/updatedAt are deterministic across runs. */
const SEED_EPOCH_MS = Date.parse("2026-09-01T00:00:00.000Z");

const seedTimestamp = (index: number): Timestamp =>
  Timestamp.fromMillis(SEED_EPOCH_MS + index * 60_000);

export const seedProductDocument = (p: SeedProduct, index: number): Record<string, unknown> => {
  const ts = seedTimestamp(index);
  return {
    productId: p.productId,
    name: p.name,
    description: p.description,
    price: p.price,
    ...(p.mrp !== undefined && { mrp: p.mrp }),
    category: p.category,
    imageUrl: `https://seed.mg.test/${p.productId}.png`,
    stock: p.stock,
    unit: p.unit,
    isFeatured: false,
    // Flags are written only when the catalog states them, so a "legacy"
    // seed product with no flag fields exercises the missing-field path.
    ...(p.isActive !== undefined && { isActive: p.isActive }),
    ...(p.isAvailable !== undefined && { isAvailable: p.isAvailable }),
    ...(p.minOrderExempt !== undefined && { minOrderExempt: p.minOrderExempt }),
    createdAt: ts,
    updatedAt: ts,
  };
};

export const deleteSeedProducts = async (db: Firestore): Promise<number> => {
  const snapshot = await db
    .collection(COLLECTIONS.PRODUCTS)
    .where("productId", ">=", SEED_PREFIX)
    .where("productId", "<", SEED_PREFIX + "")
    .get();
  const batch = db.batch();
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snapshot.size;
};

export interface LoadSeedResult {
  products: number;
  deleted: number;
  adminUserId: string;
}

export const loadSeed = async (
  db: Firestore,
  catalog: SeedCatalog,
  options: { reset?: boolean } = {}
): Promise<LoadSeedResult> => {
  let deleted = 0;
  if (options.reset) {
    deleted = await deleteSeedProducts(db);
  }

  const batch = db.batch();
  catalog.products.forEach((p, i) => {
    batch.set(db.collection(COLLECTIONS.PRODUCTS).doc(p.productId), seedProductDocument(p, i));
  });

  const ts = seedTimestamp(0);
  const passwordHash = await bcrypt.hash(catalog.admin.password, 10);
  const adminRef = db.collection(COLLECTIONS.USERS).doc(catalog.admin.userId);
  const existing = await adminRef.get();
  // Keep an existing hash so the admin doc is stable across runs (bcrypt salts differ)
  batch.set(adminRef, {
    userId: catalog.admin.userId,
    email: catalog.admin.email,
    passwordHash: existing.exists
      ? ((existing.data() as { passwordHash?: string }).passwordHash ?? passwordHash)
      : passwordHash,
    name: catalog.admin.name,
    phoneNumber: catalog.admin.phoneNumber,
    role: "admin",
    createdAt: ts,
    updatedAt: ts,
  });

  await batch.commit();
  return { products: catalog.products.length, deleted, adminUserId: catalog.admin.userId };
};
