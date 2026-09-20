/**
 * Shared helpers for emulator-backed integration tests.
 *
 * Import `app` lazily through `getApp()` so the env set in setup.ts is
 * guaranteed to be present before firebase.ts initialises.
 */
import request from "supertest";
import type { Express } from "express";

let cachedApp: Express | null = null;

export const getApp = async (): Promise<Express> => {
  if (!cachedApp) {
    const mod = await import("../app.js");
    cachedApp = mod.default;
  }
  return cachedApp;
};

/** Wipes every document in the emulator (Firestore emulator REST endpoint). */
export const clearEmulator = async (): Promise<void> => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const res = await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(`clearEmulator failed: ${res.status} ${await res.text()}`);
  }
};

let userSeq = 0;

export interface TestUser {
  userId: string;
  email: string;
  password: string;
  token: string;
}

/** Registers a fresh customer through the public API and returns its JWT. */
export const registerUser = async (
  overrides: Record<string, unknown> = {}
): Promise<TestUser> => {
  const app = await getApp();
  userSeq += 1;
  const email = `user${userSeq}-${Date.now()}@mg.test`;
  const password = "secret123";
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      email,
      password,
      firstName: "Test",
      lastName: `User${userSeq}`,
      phone: "9876543210",
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    userId: res.body.data.user.userId as string,
    email,
    password,
    token: res.body.data.token as string,
  };
};

export const login = async (email: string, password: string): Promise<string> => {
  const app = await getApp();
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.token as string;
};

/** Promotes a user to admin by writing the role directly (there is no API for it). */
export const promoteToAdmin = async (userId: string): Promise<void> => {
  const { getDb, COLLECTIONS } = await import("../services/firebase.js");
  await getDb().collection(COLLECTIONS.USERS).doc(userId).update({ role: "admin" });
};

export const registerAdmin = async (): Promise<TestUser> => {
  const user = await registerUser();
  await promoteToAdmin(user.userId);
  return user;
};

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Writes a product document directly, mirroring what BUSY/admin would store. */
export const putProduct = async (
  productId: string,
  fields: Record<string, unknown>
): Promise<void> => {
  const { getDb, COLLECTIONS, createTimestamp } = await import("../services/firebase.js");
  const now = createTimestamp();
  await getDb()
    .collection(COLLECTIONS.PRODUCTS)
    .doc(productId)
    .set({
      productId,
      name: `Product ${productId}`,
      description: `Description for ${productId}`,
      price: 100,
      category: "Pantry",
      imageUrl: "https://example.com/p.png",
      stock: 10,
      unit: "piece",
      isFeatured: false,
      createdAt: now,
      updatedAt: now,
      ...fields,
    });
};

export const readDoc = async (path: string): Promise<Record<string, unknown> | null> => {
  const { getDb } = await import("../services/firebase.js");
  const snap = await getDb().doc(path).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
};

export const listDocs = async (path: string): Promise<Record<string, unknown>[]> => {
  const { getDb } = await import("../services/firebase.js");
  const snap = await getDb().collection(path).get();
  return snap.docs.map((d) => d.data() as Record<string, unknown>);
};

/** Writes an order document directly (legacy shape) for authorisation tests. */
export const putOrder = async (
  orderId: string,
  userId: string,
  fields: Record<string, unknown> = {}
): Promise<void> => {
  const { getDb, COLLECTIONS, createTimestamp } = await import("../services/firebase.js");
  const now = createTimestamp();
  await getDb()
    .collection(COLLECTIONS.ORDERS)
    .doc(orderId)
    .set({
      orderId,
      userId,
      items: [{ productId: "P1", name: "Product P1", price: 100, quantity: 1 }],
      totalAmount: 100,
      status: "pending",
      shippingAddress: { street: "s", city: "c", state: "st", zipCode: "z" },
      paymentDetails: { paymentMethod: "COD" },
      createdAt: now,
      updatedAt: now,
      ...fields,
    });
};
