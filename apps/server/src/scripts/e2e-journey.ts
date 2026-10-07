/**
 * CLI: the whole customer ordering journey over HTTP against a running server.
 *
 *   pnpm --filter @mg-mart/server e2e -- --base-url https://mg-mart-server-test.onrender.com
 *   E2E_BASE_URL=http://localhost:5000 pnpm --filter @mg-mart/server e2e
 *
 * Repeatable and non-interactive: every run registers fresh customers, so no
 * reset is needed, and the only catalogue change it makes (one product taken
 * out of stock to exercise a flagged line) is restored before it exits.
 *
 * Exit codes: 0 all steps passed · 1 a step failed · 2 the environment is not
 * usable (no base URL, server unreachable, seed catalog or seed admin absent).
 *
 * Nothing is asserted against hardcoded fee or minimum-order amounts: the
 * expected bill is derived from the `appliedConfig` the deployment itself
 * returns, so the script is meaningful before the real fee values are decided.
 */
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { haversineKm, destinationPoint } from "../domain/geo.js";

const args = process.argv.slice(2);
const argOf = (name: string): string | undefined => {
  const i = args.indexOf(name);
  const next = i === -1 ? undefined : args[i + 1];
  if (next && !next.startsWith("--")) return next;
  const inline = args.find((a) => a.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
};

const BASE_URL = (argOf("--base-url") ?? process.env.E2E_BASE_URL ?? "").replace(/\/+$/, "");
const API = `${BASE_URL}/api/v1`;
const REQUEST_TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS ?? 30_000);
/** Render free services cold-start; give /health time before giving up. */
const BOOT_TIMEOUT_MS = Number(process.env.E2E_BOOT_TIMEOUT_MS ?? 120_000);

/** The store the deployment is configured with; verified in step 3 against a saved address. */
const STORE = {
  lat: Number(process.env.E2E_STORE_LAT ?? 26.48872184),
  lng: Number(process.env.E2E_STORE_LNG ?? 84.98157501),
};
/**
 * The admin the journey logs in as. The seed catalog defines it and the loader
 * creates it, so the credentials are read from the catalog rather than repeated
 * here; a deployment seeded from elsewhere overrides them through the env.
 */
const seedAdmin = (): { email: string; password: string } => {
  const envEmail = process.env.E2E_ADMIN_EMAIL;
  const envPassword = process.env.E2E_ADMIN_PASSWORD;
  if (envEmail && envPassword) return { email: envEmail, password: envPassword };
  const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "seed", "catalog.v1.json");
  let admin: { email?: string; password?: string };
  try {
    admin = (JSON.parse(readFileSync(catalogPath, "utf8")) as { admin: { email: string; password: string } }).admin;
  } catch (e) {
    throw new EnvUnusable(
      `could not read the seed admin from ${catalogPath} (${(e as Error).message}) — ` +
        `set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD instead`
    );
  }
  const email = envEmail ?? admin.email;
  const password = envPassword ?? admin.password;
  if (!email || !password) {
    throw new EnvUnusable("the seed catalog names no admin; set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  }
  return { email, password };
};

/** Seed products this journey relies on, with the prices the catalog states. */
const P = {
  atta: { id: "SEED-ATTA-5KG", price: 180, exempt: false },
  oil: { id: "SEED-OIL-MUSTARD-1L", price: 180, exempt: true },
  biscuit: { id: "SEED-BISCUIT-PACK", price: 60, exempt: false },
  salt: { id: "SEED-SALT-1KG", price: 25, exempt: false },
  unavailable: { id: "SEED-UNAVAIL-PANEER", price: 90, exempt: false },
  inactive: { id: "SEED-INACTIVE-GHEE", price: 350, exempt: false },
};

class StepFailed extends Error {}
class EnvUnusable extends Error {}

const fail = (message: string): never => {
  throw new StepFailed(message);
};
const ok = (condition: unknown, message: string): void => {
  if (!condition) fail(message);
};
const eq = (actual: unknown, expected: unknown, what: string): void => {
  if (actual !== expected) {
    fail(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};
const near = (actual: number, expected: number, tolerance: number, what: string): void => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    fail(`${what}: expected ${expected} ±${tolerance}, got ${actual}`);
  }
};

interface Res {
  status: number;
  body: any;
}

const call = async (
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<Res> => {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  let res: Response;
  try {
    const init = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      signal: AbortSignal.timeout(opts.timeoutMs ?? REQUEST_TIMEOUT_MS),
    };
    // The shared tsconfig loads lib.dom alongside @types/node, so AbortSignal
    // resolves to the DOM declaration while fetch expects Node's.
    res = await fetch(url, init as unknown as Parameters<typeof fetch>[1]);
  } catch (e) {
    fail(`${method} ${url} did not answer: ${(e as Error).message}`);
  }
  const text = await res!.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res!.status, body };
};

const expectStatus = (res: Res, expected: number, what: string): Res => {
  if (res.status !== expected) {
    fail(`${what}: expected HTTP ${expected}, got ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
};

/** Shared state threaded through the steps. */
const s: {
  a: { token: string; userId: string; email: string };
  b: { token: string; userId: string; email: string };
  adminToken: string;
  nearAddressId: string;
  farAddressId: string;
  radiusKm: number;
  minOrderValue: number;
  quoteBill: any;
  orderId: string;
  idempotencyKey: string;
} = {} as any;

let biscuitTakenOffline = false;

const unique = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Generated per run: the customers this journey registers outlive it by nothing. */
const throwawayPassword = `e2e-${randomBytes(18).toString("base64url")}`;

const register = async (label: string) => {
  const email = `e2e-${label}-${unique()}@mg.test`;
  const res = expectStatus(
    await call("POST", "/auth/register", {
      body: {
        email,
        password: throwawayPassword,
        firstName: "E2E",
        lastName: label.toUpperCase(),
        phone: "9876543210",
      },
    }),
    201,
    `register ${label}`
  );
  return { token: res.body.data.token as string, userId: res.body.data.user.userId as string, email };
};

const quote = async (token: string, addressId?: string): Promise<any> => {
  const res = expectStatus(
    await call("POST", "/cart/quote", { token, body: addressId ? { addressId } : {} }),
    200,
    "POST /cart/quote"
  );
  return res.body.data;
};

const setBiscuitAvailability = async (isAvailable: boolean): Promise<void> => {
  expectStatus(
    await call("PUT", `/products/${P.biscuit.id}`, { token: s.adminToken, body: { isAvailable } }),
    200,
    `admin PUT /products/${P.biscuit.id} { isAvailable: ${isAvailable} }`
  );
  biscuitTakenOffline = !isAvailable;
};

const addressBody = (point: { lat: number; lng: number }, label: string) => ({
  label,
  recipientName: "Sita Devi",
  phone: "9876543210",
  line1: "Ward 4, near Shiv Mandir",
  landmark: "Opp. primary school",
  area: "Pipra Bazar",
  pincode: "845416",
  lat: point.lat,
  lng: point.lng,
  accuracyM: 12,
});

const blockerCodes = (blockers: any[]): string[] => blockers.map((b) => b.code);
const line = (bill: any, productId: string) =>
  bill.lines.find((l: any) => l.productId === productId);

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type Step = [name: string, run: () => Promise<void>];

const steps: Step[] = [
  [
    "server is up and seeded",
    async () => {
      const deadline = Date.now() + BOOT_TIMEOUT_MS;
      let health: Res | null = null;
      for (;;) {
        try {
          health = await call("GET", `${BASE_URL}/health`, { timeoutMs: 15_000 });
          if (health.status === 200) break;
        } catch {
          // a cold service refuses connections until it has booted
        }
        if (Date.now() > deadline) {
          throw new EnvUnusable(
            `${BASE_URL}/health did not return 200 within ${BOOT_TIMEOUT_MS / 1000}s` +
              (health ? ` (last status ${health.status})` : "")
          );
        }
        await new Promise((r) => setTimeout(r, 3_000));
      }

      for (const p of Object.values(P)) {
        const res = await call("GET", `/products/${p.id}`);
        if (p.id === P.inactive.id) {
          // inactive products are hidden from customers; its absence here is correct
          if (res.status !== 404 && res.status !== 200) {
            throw new EnvUnusable(
              `GET /products/${p.id}: expected 200 or 404, got ${res.status} — is the seed catalog loaded?`
            );
          }
          continue;
        }
        if (res.status !== 200) {
          throw new EnvUnusable(
            `GET /products/${p.id} returned ${res.status} — load the seed catalog first ` +
              `(pnpm --filter @mg-mart/server seed:test)`
          );
        }
        eq(res.body.data.price, p.price, `${p.id} price`);
        eq(res.body.data.minOrderExempt, p.exempt, `${p.id} minOrderExempt`);
      }
    },
  ],

  [
    "two customers register, the seed admin logs in",
    async () => {
      s.a = await register("a");
      s.b = await register("b");
      const admin = seedAdmin();
      const res = await call("POST", "/auth/login", {
        body: { email: admin.email, password: admin.password },
      });
      if (res.status !== 200) {
        throw new EnvUnusable(
          `seed admin ${admin.email} could not log in (${res.status}) — the seed loader creates it; ` +
            `run seed:test against this environment, or set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD`
        );
      }
      s.adminToken = res.body.data.token;
      const adminOnly = await call("GET", "/products?includeInactive=1", { token: s.adminToken });
      if (adminOnly.status !== 200) {
        throw new EnvUnusable(
          `${admin.email} is not an admin on this deployment (includeInactive=1 → ${adminOnly.status})`
        );
      }
    },
  ],

  [
    "an address inside the radius saves as serviceable",
    async () => {
      const point = destinationPoint(STORE, 1.5, 30);
      const res = expectStatus(
        await call("POST", "/addresses", { token: s.a.token, body: addressBody(point, "Home") }),
        201,
        "POST /addresses (inside radius)"
      );
      const a = res.body.data;
      s.nearAddressId = a.addressId;
      s.radiusKm = a.serviceability.radiusKm;
      eq(a.isDefault, true, "first address is the default");
      eq(a.serviceability.status, "serviceable", "serviceability.status");
      eq(a.serviceability.reason, undefined, "a serviceable address carries no reason");
      // Also proves the deployment's STORE_LAT/STORE_LNG are the ones this run assumes.
      near(
        a.serviceability.distanceKm,
        haversineKm(STORE, point),
        0.05,
        "distanceKm (deployment STORE_LAT/STORE_LNG vs E2E_STORE_LAT/LNG)"
      );
      ok(
        a.serviceability.distanceKm < s.radiusKm,
        `1.5 km address should be inside the ${s.radiusKm} km radius`
      );
    },
  ],

  [
    "an address outside the radius is saved, not rejected, and is unserviceable",
    async () => {
      const point = destinationPoint(STORE, s.radiusKm + 2, 120);
      const res = expectStatus(
        await call("POST", "/addresses", { token: s.a.token, body: addressBody(point, "Farm") }),
        201,
        "POST /addresses (outside radius)"
      );
      const a = res.body.data;
      s.farAddressId = a.addressId;
      eq(a.isDefault, false, "a second address does not steal the default");
      eq(a.serviceability.status, "not_serviceable", "serviceability.status");
      eq(a.serviceability.reason, "OUTSIDE_RADIUS", "serviceability.reason");
      ok(a.serviceability.distanceKm > s.radiusKm, "distanceKm is outside the radius");

      const list = expectStatus(
        await call("GET", "/addresses", { token: s.a.token }),
        200,
        "GET /addresses"
      );
      eq(list.body.data.length, 2, "both addresses are listed");
      eq(list.body.data[0].addressId, s.nearAddressId, "the default address is listed first");
    },
  ],

  [
    "a non-orderable product cannot enter the cart",
    async () => {
      const unavailable = expectStatus(
        await call("POST", "/cart/add", {
          token: s.a.token,
          body: { productId: P.unavailable.id, quantity: 1 },
        }),
        422,
        "POST /cart/add (unavailable product)"
      );
      eq(unavailable.body.code, "LINE_NOT_ORDERABLE", "code");
      eq(unavailable.body.reason, "UNAVAILABLE", "reason");

      const inactive = expectStatus(
        await call("POST", "/cart/add", {
          token: s.a.token,
          body: { productId: P.inactive.id, quantity: 1 },
        }),
        422,
        "POST /cart/add (inactive product)"
      );
      eq(inactive.body.code, "LINE_NOT_ORDERABLE", "code");
      eq(inactive.body.reason, "INACTIVE", "reason");
    },
  ],

  [
    "a below-minimum cart quotes with the right eligibility and shortfall",
    async () => {
      for (const [productId, quantity] of [
        [P.atta.id, 1],
        [P.oil.id, 1],
        [P.biscuit.id, 1],
      ] as const) {
        expectStatus(
          await call("POST", "/cart/add", { token: s.a.token, body: { productId, quantity } }),
          200,
          `POST /cart/add ${productId}`
        );
      }

      const q = await quote(s.a.token);
      const bill = q.bill;
      s.minOrderValue = bill.minOrderValue;

      eq(q.addressId, s.nearAddressId, "quote defaults to the default address");
      eq(q.serviceability.status, "serviceable", "serviceability.status");
      eq(bill.minOrderValue, bill.appliedConfig.minOrderValue, "bill.minOrderValue == appliedConfig");

      const subtotal = P.atta.price + P.oil.price + P.biscuit.price;
      const eligible = P.atta.price + P.biscuit.price; // the mustard oil is exempt
      eq(bill.subtotal, subtotal, "subtotal");
      eq(bill.eligibleAmount, eligible, "eligibleAmount excludes the exempt line");
      eq(line(bill, P.oil.id).minOrderExempt, true, `${P.oil.id} is marked exempt`);

      if (eligible >= s.minOrderValue) {
        throw new EnvUnusable(
          `MIN_ORDER_VALUE on this deployment (${s.minOrderValue}) is below the ₹${eligible} ` +
            `starter cart, so the below-minimum leg cannot be exercised`
        );
      }
      eq(bill.minOrderMet, false, "minOrderMet");
      eq(bill.shortfall, s.minOrderValue - eligible, "shortfall");
      eq(bill.orderable, false, "orderable");
      eq(blockerCodes(bill.blockers).join(","), "ORDER_BELOW_MINIMUM", "blockers");
      eq(bill.blockers[0].shortfall, bill.shortfall, "the blocker repeats the shortfall");

      // Fees follow appliedConfig, whatever this environment's amounts are.
      const feeOf = (rule: any) =>
        rule.amount <= 0 || (rule.waivedAtOrAbove !== null && subtotal >= rule.waivedAtOrAbove)
          ? 0
          : rule.amount;
      eq(bill.deliveryFee, feeOf(bill.appliedConfig.deliveryFee), "deliveryFee follows appliedConfig");
      eq(bill.handlingFee, feeOf(bill.appliedConfig.handlingFee), "handlingFee follows appliedConfig");
      eq(bill.total, bill.subtotal + bill.deliveryFee + bill.handlingFee, "total");
    },
  ],

  [
    "a line whose product goes out of stock is kept, flagged and blocks the quote",
    async () => {
      await setBiscuitAvailability(false);

      const cart = expectStatus(await call("GET", "/cart", { token: s.a.token }), 200, "GET /cart");
      const cartLine = cart.body.data.items.find((i: any) => i.productId === P.biscuit.id);
      ok(cartLine, "the flagged line is kept in the cart, not dropped");
      eq(cartLine.isOrderable, false, "cart line isOrderable");
      eq(cartLine.blocker, "UNAVAILABLE", "cart line blocker");

      const bill = (await quote(s.a.token)).bill;
      eq(line(bill, P.biscuit.id).isOrderable, false, "quote line isOrderable");
      eq(bill.orderable, false, "orderable");
      ok(
        blockerCodes(bill.blockers).includes("LINE_NOT_ORDERABLE"),
        `expected LINE_NOT_ORDERABLE among ${blockerCodes(bill.blockers).join(",")}`
      );
      const blocker = bill.blockers.find((b: any) => b.code === "LINE_NOT_ORDERABLE");
      eq(blocker.productId, P.biscuit.id, "the blocker names the product");
      eq(blocker.reason, "UNAVAILABLE", "the blocker carries the reason");
      // The line still counts toward the money; only ordering is blocked.
      eq(bill.subtotal, P.atta.price + P.oil.price + P.biscuit.price, "subtotal is unchanged");

      const updated = await call("PUT", `/cart/items/${P.biscuit.id}`, {
        token: s.a.token,
        body: { quantity: 3 },
      });
      eq(updated.status, 422, "a quantity change on a non-orderable line is refused");
      eq(updated.body.code, "LINE_NOT_ORDERABLE", "code");
    },
  ],

  [
    "quoting against the out-of-radius address blocks on serviceability",
    async () => {
      const q = await quote(s.a.token, s.farAddressId);
      eq(q.addressId, s.farAddressId, "the quote used the requested address");
      eq(q.serviceability.status, "not_serviceable", "serviceability.status");
      const blocker = q.bill.blockers.find((b: any) => b.code === "ADDRESS_NOT_SERVICEABLE");
      ok(blocker, `expected ADDRESS_NOT_SERVICEABLE among ${blockerCodes(q.bill.blockers).join(",")}`);
      eq(blocker.radiusKm, s.radiusKm, "the blocker states the radius");
      eq(q.orderable, false, "orderable");
    },
  ],

  [
    "a quote the customer cannot own is refused",
    async () => {
      const res = await call("POST", "/cart/quote", {
        token: s.b.token,
        body: { addressId: s.nearAddressId },
      });
      eq(res.status, 403, "another customer's addressId is refused");
      eq(res.body.code, "ADDRESS_NOT_OWNED", "code");
    },
  ],

  [
    "fixing the cart makes the quote orderable",
    async () => {
      await setBiscuitAvailability(true);
      expectStatus(
        await call("DELETE", `/cart/items/${P.biscuit.id}`, { token: s.a.token }),
        200,
        `DELETE /cart/items/${P.biscuit.id}`
      );

      // Enough non-exempt atta to clear whatever minimum this environment sets.
      const attaQty = Math.ceil(s.minOrderValue / P.atta.price);
      expectStatus(
        await call("PUT", `/cart/items/${P.atta.id}`, {
          token: s.a.token,
          body: { quantity: attaQty },
        }),
        200,
        `PUT /cart/items/${P.atta.id}`
      );

      const q = await quote(s.a.token);
      const bill = q.bill;
      eq(bill.eligibleAmount, attaQty * P.atta.price, "eligibleAmount");
      eq(bill.subtotal, attaQty * P.atta.price + P.oil.price, "subtotal includes the exempt line");
      eq(bill.minOrderMet, true, "minOrderMet");
      eq(bill.shortfall, 0, "shortfall");
      eq(bill.blockers.length, 0, `expected no blockers, got ${blockerCodes(bill.blockers).join(",")}`);
      eq(bill.orderable, true, "orderable");
      eq(q.orderable, bill.orderable, "quote.orderable mirrors bill.orderable");
      eq(bill.total, bill.subtotal + bill.deliveryFee + bill.handlingFee, "total");
      s.quoteBill = bill;
    },
  ],

  [
    "an order is refused for an out-of-radius address, and the cart survives",
    async () => {
      const res = await call("POST", "/orders", {
        token: s.a.token,
        body: {
          addressId: s.farAddressId,
          paymentMethod: "COD",
          idempotencyKey: `e2e-far-${unique()}`,
        },
      });
      eq(res.status, 422, "POST /orders (out of radius)");
      eq(res.body.code, "ADDRESS_NOT_SERVICEABLE", "code");
      ok(Array.isArray(res.body.blockers), "the 422 carries blockers[]");
      eq(res.body.serviceability.status, "not_serviceable", "the 422 carries serviceability");

      const count = expectStatus(
        await call("GET", "/cart/count", { token: s.a.token }),
        200,
        "GET /cart/count"
      );
      eq(count.body.data.itemCount > 0, true, "a refused order leaves the cart alone");
    },
  ],

  [
    "order creation validates its input",
    async () => {
      const noKey = await call("POST", "/orders", {
        token: s.a.token,
        body: { addressId: s.nearAddressId, paymentMethod: "COD" },
      });
      eq(noKey.status, 400, "POST /orders without idempotencyKey");
      eq(noKey.body.code, "IDEMPOTENCY_KEY_REQUIRED", "code");

      const online = await call("POST", "/orders", {
        token: s.a.token,
        body: {
          addressId: s.nearAddressId,
          paymentMethod: "Online",
          idempotencyKey: `e2e-online-${unique()}`,
        },
      });
      eq(online.status, 400, "POST /orders with paymentMethod Online");
      eq(online.body.field, "paymentMethod", "field");

      const badId = await call("POST", "/orders", {
        token: s.a.token,
        body: {
          addressId: "../../etc/passwd",
          paymentMethod: "COD",
          idempotencyKey: `e2e-badid-${unique()}`,
        },
      });
      eq(badId.status, 400, "POST /orders with a malformed addressId");
      eq(badId.body.code, "VALIDATION_ERROR", "code");
      eq(badId.body.field, "addressId", "field");

      const notOwned = await call("POST", "/orders", {
        token: s.b.token,
        body: {
          addressId: s.nearAddressId,
          paymentMethod: "COD",
          idempotencyKey: `e2e-notowned-${unique()}`,
        },
      });
      eq(notOwned.status, 403, "POST /orders with another customer's address");
      eq(notOwned.body.code, "ADDRESS_NOT_OWNED", "code");
    },
  ],

  [
    "a COD order is placed, and a lying client cannot change a single rupee",
    async () => {
      s.idempotencyKey = `e2e-order-${unique()}`;
      const res = expectStatus(
        await call("POST", "/orders", {
          token: s.a.token,
          body: {
            addressId: s.nearAddressId,
            paymentMethod: "COD",
            idempotencyKey: s.idempotencyKey,
            // Everything below is a client trying to price its own order.
            totalAmount: 1,
            subtotal: 1,
            deliveryFee: 0,
            handlingFee: 0,
            bill: { total: 1, subtotal: 1, minOrderMet: true, orderable: true, blockers: [] },
            items: [{ productId: P.salt.id, name: "Salt", price: 1, quantity: 1 }],
            shippingAddress: { street: "forged", city: "forged", state: "forged", zipCode: "000000" },
            status: "delivered",
            paymentStatus: "paid",
            userId: s.b.userId,
          },
        }),
        201,
        "POST /orders"
      );
      const order = res.body.data;
      s.orderId = order.orderId;

      eq(order.userId, s.a.userId, "the order belongs to the caller, not the forged userId");
      eq(order.status, "pending", "a new order is pending, whatever the client sent");
      eq(order.paymentStatus, "pending", "paymentStatus");
      eq(order.paymentDetails.paymentMethod, "COD", "paymentMethod");
      eq(order.idempotencyKey, s.idempotencyKey, "idempotencyKey is stored");

      eq(JSON.stringify(order.bill), JSON.stringify(s.quoteBill), "the order's bill is the quote's bill");
      eq(order.totalAmount, s.quoteBill.total, "totalAmount mirrors bill.total");
      eq(order.items.length, s.quoteBill.lines.length, "the forged items[] was ignored");
      ok(
        !order.items.some((i: any) => i.productId === P.salt.id),
        "the forged line did not reach the order"
      );
      for (const l of s.quoteBill.lines) {
        const item = order.items.find((i: any) => i.productId === l.productId);
        ok(item, `order item ${l.productId}`);
        eq(item.unitPrice, l.unitPrice, `${l.productId} unitPrice`);
        eq(item.lineTotal, l.lineTotal, `${l.productId} lineTotal`);
        eq(item.minOrderExempt, l.minOrderExempt, `${l.productId} minOrderExempt`);
      }

      eq(order.addressSnapshot.addressId, s.nearAddressId, "addressSnapshot.addressId");
      eq(order.addressSnapshot.radiusKm, s.radiusKm, "addressSnapshot.radiusKm");
      ok(
        typeof order.addressSnapshot.distanceKm === "number",
        "addressSnapshot records the distance it was judged on"
      );
      ok(order.shippingAddress.street !== "forged", "the forged legacy address was ignored");

      const cart = expectStatus(await call("GET", "/cart", { token: s.a.token }), 200, "GET /cart");
      eq(cart.body.data.items.length, 0, "the cart is cleared once the order exists");
    },
  ],

  [
    "re-submitting the same idempotency key returns the same order",
    async () => {
      const res = expectStatus(
        await call("POST", "/orders", {
          token: s.a.token,
          body: {
            addressId: s.nearAddressId,
            paymentMethod: "COD",
            idempotencyKey: s.idempotencyKey,
          },
        }),
        200,
        "POST /orders (replay)"
      );
      eq(res.body.replayed, true, "the replay says so");
      eq(res.body.data.orderId, s.orderId, "the replay returns the original order");
      eq(res.body.data.totalAmount, s.quoteBill.total, "the replayed total is unchanged");

      const mine = expectStatus(
        await call("GET", "/orders", { token: s.a.token }),
        200,
        "GET /orders"
      );
      eq(
        mine.body.data.orders.filter((o: any) => o.idempotencyKey === s.idempotencyKey).length,
        1,
        "the replay did not create a second order"
      );
    },
  ],

  [
    "an order is visible to its owner and to nobody else",
    async () => {
      const own = expectStatus(
        await call("GET", `/orders/${s.orderId}`, { token: s.a.token }),
        200,
        "GET /orders/:id (owner)"
      );
      eq(own.body.data.orderId, s.orderId, "orderId");

      const other = await call("GET", `/orders/${s.orderId}`, { token: s.b.token });
      eq(other.status, 403, "GET /orders/:id (another customer)");

      const anon = await call("GET", `/orders/${s.orderId}`);
      eq(anon.status, 401, "GET /orders/:id (no token)");

      const mine = expectStatus(
        await call("GET", "/orders", { token: s.a.token }),
        200,
        "GET /orders (owner)"
      );
      ok(
        mine.body.data.orders.every((o: any) => o.userId === s.a.userId),
        "the customer's list holds only their own orders"
      );
      ok(
        mine.body.data.orders.some((o: any) => o.orderId === s.orderId),
        "the new order is in the customer's list"
      );

      const theirs = expectStatus(
        await call("GET", "/orders", { token: s.b.token }),
        200,
        "GET /orders (other customer)"
      );
      ok(
        !theirs.body.data.orders.some((o: any) => o.orderId === s.orderId),
        "the order does not leak into another customer's list"
      );

      // The userId query parameter is not a way around the scoping.
      const spoofed = expectStatus(
        await call("GET", `/orders?userId=${s.a.userId}`, { token: s.b.token }),
        200,
        "GET /orders?userId=<someone else>"
      );
      ok(
        !spoofed.body.data.orders.some((o: any) => o.orderId === s.orderId),
        "?userId is ignored for customers"
      );
    },
  ],

  [
    "below the minimum an order is refused even when no quote was asked for",
    async () => {
      expectStatus(
        await call("POST", "/cart/add", {
          token: s.a.token,
          body: { productId: P.salt.id, quantity: 1 },
        }),
        200,
        `POST /cart/add ${P.salt.id}`
      );
      const res = await call("POST", "/orders", {
        token: s.a.token,
        body: {
          addressId: s.nearAddressId,
          paymentMethod: "COD",
          idempotencyKey: `e2e-below-${unique()}`,
          // The client claims the minimum is met; the server recomputes from stored data.
          bill: { minOrderMet: true, orderable: true, total: 25, blockers: [] },
          totalAmount: 25,
        },
      });
      eq(res.status, 422, "POST /orders (below minimum)");
      eq(res.body.code, "ORDER_BELOW_MINIMUM", "code");
      const blocker = res.body.blockers.find((b: any) => b.code === "ORDER_BELOW_MINIMUM");
      eq(blocker.shortfall, s.minOrderValue - P.salt.price, "shortfall");

      expectStatus(
        await call("DELETE", "/cart/clear", { token: s.a.token }),
        200,
        "DELETE /cart/clear"
      );
      const empty = await call("POST", "/orders", {
        token: s.a.token,
        body: {
          addressId: s.nearAddressId,
          paymentMethod: "COD",
          idempotencyKey: `e2e-empty-${unique()}`,
        },
      });
      eq(empty.status, 422, "POST /orders (empty cart)");
      eq(empty.body.code, "CART_EMPTY", "code");
    },
  ],

  [
    "only an admin moves the order's status",
    async () => {
      const refused = await call("PUT", `/orders/${s.orderId}/status`, {
        token: s.a.token,
        body: { status: "processing" },
      });
      eq(refused.status, 403, "a customer cannot change a status");

      const promoted = expectStatus(
        await call("PUT", `/orders/${s.orderId}/status`, {
          token: s.adminToken,
          body: { status: "processing" },
        }),
        200,
        "admin PUT /orders/:id/status"
      );
      eq(promoted.body.data.status, "processing", "status");

      const illegal = await call("PUT", `/orders/${s.orderId}/status`, {
        token: s.adminToken,
        body: { status: "pending" },
      });
      eq(illegal.status, 400, "processing → pending is refused");

      const seen = expectStatus(
        await call("GET", `/orders/${s.orderId}`, { token: s.a.token }),
        200,
        "GET /orders/:id after the status change"
      );
      eq(seen.body.data.status, "processing", "the customer sees the new status");
      eq(seen.body.data.totalAmount, s.quoteBill.total, "the bill did not move with the status");

      const asAdmin = expectStatus(
        await call("GET", `/orders/${s.orderId}`, { token: s.adminToken }),
        200,
        "GET /orders/:id (admin)"
      );
      eq(asAdmin.body.data.orderId, s.orderId, "an admin reads any order");
    },
  ],
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const runSeed = async (): Promise<void> => {
  const { resolveSeedTarget, SeedTargetError } = await import("../seed/seedGuard.js");
  let target;
  try {
    target = resolveSeedTarget(process.env, { allowProject: args.includes("--allow-project") });
  } catch (e) {
    if (e instanceof SeedTargetError) throw new EnvUnusable(`--seed refused: ${e.message}`);
    throw e;
  }
  const { getDb } = await import("../services/firebase.js");
  const { loadSeed, readSeedCatalog } = await import("../seed/loadSeed.js");
  const result = await loadSeed(getDb(), readSeedCatalog(), { reset: args.includes("--reset") });
  console.log(
    `seed → ${target.kind === "emulator" ? `emulator ${target.host}` : target.projectId}: ` +
      `${result.products} products, admin ${result.adminUserId}\n`
  );
};

const main = async (): Promise<number> => {
  if (!BASE_URL) {
    console.error(
      "No base URL. Pass --base-url https://… or set E2E_BASE_URL.\n" +
        "  pnpm --filter @mg-mart/server e2e -- --base-url http://localhost:5000"
    );
    return 2;
  }

  console.log(`MG Supermart E2E journey → ${BASE_URL}\n`);
  if (args.includes("--seed")) await runSeed();

  let failures = 0;
  let unusable = false;

  for (const [index, [name, run]] of steps.entries()) {
    const label = `${String(index + 1).padStart(2, " ")}. ${name}`;
    const startedAt = Date.now();
    try {
      await run();
      console.log(`PASS ${label}  (${Date.now() - startedAt}ms)`);
    } catch (e) {
      if (e instanceof EnvUnusable) {
        console.error(`\nENVIRONMENT  ${label}\n     ${e.message}`);
        unusable = true;
        break;
      }
      failures += 1;
      console.error(`FAIL ${label}\n     ${(e as Error).message}`);
      // The journey is sequential: later steps would report the same cause again.
      break;
    }
  }

  if (biscuitTakenOffline) {
    try {
      await setBiscuitAvailability(true);
      console.log(`\n(restored ${P.biscuit.id} to available)`);
    } catch (e) {
      console.error(
        `\nWARNING: ${P.biscuit.id} is still marked unavailable — ${(e as Error).message}\n` +
          `Re-run the seed loader, or set it back from the admin panel.`
      );
    }
  }

  if (unusable) return 2;
  if (failures > 0) {
    console.error(`\n${failures} step(s) failed.`);
    return 1;
  }
  console.log(`\nAll ${steps.length} steps passed against ${BASE_URL}.`);
  return 0;
};

process.exit(await main());
