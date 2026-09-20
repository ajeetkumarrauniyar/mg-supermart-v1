/** T4.1 / T4.2 — address entity, ownership, computed serviceability, mounting. */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import {
  getApp,
  clearEmulator,
  registerUser,
  auth,
  readDoc,
  type TestUser,
} from "../test/helpers.js";
import { destinationPoint } from "../domain/geo.js";
import { STORE } from "../test/fixtures.js";
import { resetStoreConfigCache } from "../config/storeConfig.js";

let a: TestUser;
let b: TestUser;

const near = destinationPoint(STORE, 1.5, 30);
const far = destinationPoint(STORE, 7, 120);

const body = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

beforeAll(async () => {
  await clearEmulator();
  a = await registerUser();
  b = await registerUser();
});

afterEach(() => {
  process.env.DELIVERY_RADIUS_KM = "5";
  resetStoreConfigCache();
});

describe("mounting (verified: /api → /v1/<name> in routes/index.ts)", () => {
  it("GET /api/v1/addresses → 200 for an authenticated user", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/addresses").set(auth(a.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("GET /api/v1/v1/addresses → 404 (no double prefix)", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/v1/addresses").set(auth(a.token));
    expect(res.status).toBe(404);
  });

  it("requires a token", async () => {
    const app = await getApp();
    expect((await request(app).get("/api/v1/addresses")).status).toBe(401);
  });
});

describe("POST /api/v1/addresses", () => {
  it("saves a nearby address as default with serviceable + distance", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/v1/addresses").set(auth(a.token)).send(body());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      label: "Home",
      area: "Pipra Bazar",
      pincode: "845416",
      isDefault: true,
      serviceability: { status: "serviceable", radiusKm: 5 },
    });
    expect(res.body.data.serviceability.distanceKm).toBeCloseTo(1.5, 1);
    expect(res.body.data.userId).toBeUndefined();

    // Nothing about serviceability is stored
    const stored = await readDoc(`users/${a.userId}/addresses/${res.body.data.addressId}`);
    expect(stored).not.toBeNull();
    expect("serviceability" in stored!).toBe(false);
    expect("isServiceable" in stored!).toBe(false);
    expect(stored!.userId).toBe(a.userId);
  });

  it("saves a 7 km address (201) reporting not_serviceable / OUTSIDE_RADIUS", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/addresses")
      .set(auth(a.token))
      .send(body({ label: "Farm", lat: far.lat, lng: far.lng, pincode: undefined, landmark: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.data.isDefault).toBe(false);
    expect(res.body.data.serviceability).toMatchObject({
      status: "not_serviceable",
      reason: "OUTSIDE_RADIUS",
      radiusKm: 5,
    });
    expect(res.body.data.serviceability.distanceKm).toBeCloseTo(7, 1);
    expect(res.body.data.pincode).toBeUndefined();
  });

  it("missing lat ⇒ 400 VALIDATION_ERROR naming the field", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/addresses")
      .set(auth(a.token))
      .send(body({ lat: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.field).toBe("lat");
  });

  it("rejects out-of-range coordinates and a bad pincode, naming the field", async () => {
    const app = await getApp();
    const lat = await request(app).post("/api/v1/addresses").set(auth(a.token)).send(body({ lat: 95 }));
    expect(lat.status).toBe(400);
    expect(lat.body.field).toBe("lat");
    const pin = await request(app)
      .post("/api/v1/addresses")
      .set(auth(a.token))
      .send(body({ pincode: "12" }));
    expect(pin.body.field).toBe("pincode");
  });
});

describe("list / ownership / default / update / delete", () => {
  it("list recomputes serviceability against the current radius", async () => {
    const app = await getApp();
    const before = await request(app).get("/api/v1/addresses").set(auth(a.token));
    const farBefore = before.body.data.find((x: any) => x.label === "Farm");
    expect(farBefore.serviceability.status).toBe("not_serviceable");

    process.env.DELIVERY_RADIUS_KM = "8";
    resetStoreConfigCache();

    const after = await request(app).get("/api/v1/addresses").set(auth(a.token));
    const farAfter = after.body.data.find((x: any) => x.label === "Farm");
    expect(farAfter.serviceability).toMatchObject({ status: "serviceable", radiusKm: 8 });
  });

  it("user B gets 403 ADDRESS_NOT_OWNED on A's address for update/delete/default", async () => {
    const app = await getApp();
    const list = await request(app).get("/api/v1/addresses").set(auth(a.token));
    const id = list.body.data[0].addressId;

    const upd = await request(app).put(`/api/v1/addresses/${id}`).set(auth(b.token)).send(body());
    expect(upd.status).toBe(403);
    expect(upd.body.code).toBe("ADDRESS_NOT_OWNED");
    const del = await request(app).delete(`/api/v1/addresses/${id}`).set(auth(b.token));
    expect(del.status).toBe(403);
    const def = await request(app).put(`/api/v1/addresses/${id}/default`).set(auth(b.token));
    expect(def.status).toBe(403);

    const bList = await request(app).get("/api/v1/addresses").set(auth(b.token));
    expect(bList.body.data).toEqual([]);
  });

  it("PUT /:id/default moves the default; PUT /:id updates and clears omitted optionals", async () => {
    const app = await getApp();
    const list = await request(app).get("/api/v1/addresses").set(auth(a.token));
    const farm = list.body.data.find((x: any) => x.label === "Farm");
    const home = list.body.data.find((x: any) => x.label === "Home");

    const def = await request(app).put(`/api/v1/addresses/${farm.addressId}/default`).set(auth(a.token));
    expect(def.status).toBe(200);
    expect(def.body.data.isDefault).toBe(true);
    const again = await request(app).get("/api/v1/addresses").set(auth(a.token));
    expect(again.body.data.find((x: any) => x.label === "Home").isDefault).toBe(false);
    expect(again.body.data[0].label).toBe("Farm"); // default sorts first

    const upd = await request(app)
      .put(`/api/v1/addresses/${home.addressId}`)
      .set(auth(a.token))
      .send(body({ label: "Home (edited)", landmark: undefined }));
    expect(upd.status).toBe(200);
    expect(upd.body.data.label).toBe("Home (edited)");
    expect(upd.body.data.landmark).toBeUndefined();
    expect(upd.body.data.isDefault).toBe(false);
  });

  it("DELETE removes it and promotes another address to default", async () => {
    const app = await getApp();
    const list = await request(app).get("/api/v1/addresses").set(auth(a.token));
    const current = list.body.data.find((x: any) => x.isDefault);
    const res = await request(app).delete(`/api/v1/addresses/${current.addressId}`).set(auth(a.token));
    expect(res.status).toBe(200);
    const after = await request(app).get("/api/v1/addresses").set(auth(a.token));
    expect(after.body.data).toHaveLength(1);
    expect(after.body.data[0].isDefault).toBe(true);
  });
});

describe("T4.2 legacy user.address is left intact", () => {
  it("PUT /users/profile still accepts the embedded address", async () => {
    const app = await getApp();
    const res = await request(app)
      .put("/api/v1/users/profile")
      .set(auth(a.token))
      .send({ address: { street: "Old St", city: "Pipra", state: "Bihar", zipCode: "845416" } });
    expect(res.status).toBe(200);
    const profile = await request(app).get("/api/v1/users/profile").set(auth(a.token));
    expect(profile.body.data.address).toEqual({
      street: "Old St",
      city: "Pipra",
      state: "Bihar",
      zipCode: "845416",
    });
  });
});
