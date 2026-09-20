import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getApp, clearEmulator } from "./helpers.js";

describe("harness smoke", () => {
  beforeAll(async () => {
    await clearEmulator();
  });

  it("GET /health responds via supertest against the emulator-backed app", async () => {
    const app = await getApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
