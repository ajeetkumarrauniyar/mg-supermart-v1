/**
 * StoreConfig loaded from validated environment variables.
 *
 * No code defaults for business values: a missing or invalid variable makes
 * `parseStoreConfig` throw a ConfigError naming every problem, the server
 * refuses to start, and quote/order respond 503 CONFIG_UNAVAILABLE.
 */
import type { FeeRule, StoreConfig } from "../domain/types.js";

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid store configuration: ${problems.join("; ")}`);
    this.name = "ConfigError";
  }
}

export const STORE_CONFIG_VARS = [
  "STORE_LAT",
  "STORE_LNG",
  "DELIVERY_RADIUS_KM",
  "MIN_ORDER_VALUE",
  "DELIVERY_FEE_AMOUNT",
  "DELIVERY_FEE_WAIVED_AT",
  "HANDLING_FEE_AMOUNT",
  "HANDLING_FEE_WAIVED_AT",
] as const;

type Env = Record<string, string | undefined>;

const isBlank = (v: string | undefined): v is undefined => v === undefined || v.trim() === "";

const readNumber = (
  env: Env,
  name: string,
  problems: string[],
  opts: { min?: number; max?: number; positive?: boolean } = {}
): number => {
  const raw = env[name];
  if (isBlank(raw)) {
    problems.push(`${name} is required`);
    return NaN;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    problems.push(`${name} must be a number (got "${raw}")`);
    return NaN;
  }
  if (opts.positive && n <= 0) problems.push(`${name} must be > 0`);
  if (opts.min !== undefined && n < opts.min) problems.push(`${name} must be >= ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) problems.push(`${name} must be <= ${opts.max}`);
  return n;
};

/** Empty ⇒ null (fee always applies); otherwise a non-negative number. */
const readWaiver = (env: Env, name: string, problems: string[]): number | null => {
  const raw = env[name];
  if (isBlank(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    problems.push(`${name} must be empty or a non-negative number (got "${raw}")`);
    return null;
  }
  return n;
};

/** Pure parser; safe to call with any env object in tests. */
export const parseStoreConfig = (env: Env, now: () => Date = () => new Date()): StoreConfig => {
  const problems: string[] = [];

  const lat = readNumber(env, "STORE_LAT", problems, { min: -90, max: 90 });
  const lng = readNumber(env, "STORE_LNG", problems, { min: -180, max: 180 });
  const deliveryRadiusKm = readNumber(env, "DELIVERY_RADIUS_KM", problems, { positive: true });
  const minOrderValue = readNumber(env, "MIN_ORDER_VALUE", problems, { min: 0 });
  const deliveryFeeAmount = readNumber(env, "DELIVERY_FEE_AMOUNT", problems, { min: 0 });
  const deliveryWaiver = readWaiver(env, "DELIVERY_FEE_WAIVED_AT", problems);
  const handlingFeeAmount = readNumber(env, "HANDLING_FEE_AMOUNT", problems, { min: 0 });
  const handlingWaiver = readWaiver(env, "HANDLING_FEE_WAIVED_AT", problems);

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  const deliveryFee: FeeRule = { amount: deliveryFeeAmount, waivedAtOrAbove: deliveryWaiver };
  const handlingFee: FeeRule = { amount: handlingFeeAmount, waivedAtOrAbove: handlingWaiver };

  return {
    store: { lat, lng },
    deliveryRadiusKm,
    minOrderValue,
    deliveryFee,
    handlingFee,
    source: "env",
    loadedAt: now().toISOString(),
  };
};

let cached: StoreConfig | null = null;

/**
 * Cached accessor over process.env. Throws ConfigError when unavailable;
 * server.ts calls it before listen (fail fast) and controllers translate the
 * error to 503 CONFIG_UNAVAILABLE.
 */
export const getStoreConfig = (): StoreConfig => {
  if (!cached) {
    cached = parseStoreConfig(process.env);
  }
  return cached;
};

/** Test hook: drop the cache so a changed env is re-read. */
export const resetStoreConfigCache = (): void => {
  cached = null;
};
