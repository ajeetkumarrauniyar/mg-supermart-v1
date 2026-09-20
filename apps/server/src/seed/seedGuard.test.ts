import { describe, it, expect } from "vitest";
import { resolveSeedTarget, SeedTargetError } from "./seedGuard.js";

describe("seed target guard (D-006)", () => {
  it("allows the emulator with any project id", () => {
    expect(
      resolveSeedTarget({ FIRESTORE_EMULATOR_HOST: "localhost:8080", FIREBASE_PROJECT_ID: "demo-x" })
    ).toEqual({ kind: "emulator", host: "localhost:8080", projectId: "demo-x" });
  });

  it("refuses the production project even with the emulator host set", () => {
    expect(() =>
      resolveSeedTarget(
        { FIRESTORE_EMULATOR_HOST: "localhost:8080", FIREBASE_PROJECT_ID: "mg-supermart-prod" },
        { allowProject: true }
      )
    ).toThrow(SeedTargetError);
  });

  it("refuses staging without --allow-project and allows it with", () => {
    expect(() => resolveSeedTarget({ FIREBASE_PROJECT_ID: "mg-supermart-staging" })).toThrow(
      /--allow-project/
    );
    expect(
      resolveSeedTarget({ FIREBASE_PROJECT_ID: "mg-supermart-staging" }, { allowProject: true })
    ).toEqual({ kind: "project", projectId: "mg-supermart-staging" });
  });

  it("refuses any other project id, and an empty env", () => {
    expect(() =>
      resolveSeedTarget({ FIREBASE_PROJECT_ID: "some-other-project" }, { allowProject: true })
    ).toThrow(SeedTargetError);
    expect(() => resolveSeedTarget({})).toThrow(SeedTargetError);
  });
});
