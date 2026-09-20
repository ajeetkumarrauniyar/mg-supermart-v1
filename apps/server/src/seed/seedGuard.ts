/**
 * Where the seed loader is allowed to write (D-006, ISS-015). Pure.
 *
 * Allowed:  the Firestore emulator (FIRESTORE_EMULATOR_HOST set), or the
 *           staging project when --allow-project is passed explicitly.
 * Never:    the production project, or any other project id.
 */
export const SEED_ALLOWED_PROJECT = "mg-supermart-staging";
export const SEED_FORBIDDEN_PROJECT = "mg-supermart-prod";

export interface SeedTargetFlags {
  allowProject?: boolean;
}

export type SeedTarget =
  | { kind: "emulator"; host: string; projectId: string }
  | { kind: "project"; projectId: string };

export class SeedTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedTargetError";
  }
}

export const resolveSeedTarget = (
  env: Record<string, string | undefined>,
  flags: SeedTargetFlags = {}
): SeedTarget => {
  const projectId = env.FIREBASE_PROJECT_ID ?? "";
  const host = env.FIRESTORE_EMULATOR_HOST;

  if (projectId === SEED_FORBIDDEN_PROJECT) {
    throw new SeedTargetError(
      `Refusing to seed the production project "${SEED_FORBIDDEN_PROJECT}"`
    );
  }

  if (host && host.trim() !== "") {
    return { kind: "emulator", host, projectId };
  }

  if (projectId === SEED_ALLOWED_PROJECT) {
    if (!flags.allowProject) {
      throw new SeedTargetError(
        `Seeding "${projectId}" requires --allow-project (no emulator detected)`
      );
    }
    return { kind: "project", projectId };
  }

  throw new SeedTargetError(
    `No seed target: set FIRESTORE_EMULATOR_HOST, or FIREBASE_PROJECT_ID=${SEED_ALLOWED_PROJECT} with --allow-project` +
      (projectId ? ` (got "${projectId}")` : "")
  );
};
