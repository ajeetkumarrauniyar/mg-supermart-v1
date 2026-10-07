# Deploying an isolated test backend and running the end-to-end journey

Two things live here: how to stand up an isolated, seeded instance of this backend,
and how to prove the whole customer ordering journey against it with one command.

The journey script is `src/scripts/e2e-journey.ts` (`pnpm --filter @mg-mart/server e2e`).
It talks only HTTP, so the same command verifies a local process and a deployed URL.

---

## 1. Run it locally first

Nothing here touches a real project: the Firestore emulator uses the `demo-` project id,
which firebase-tools treats as offline-only.

```bash
# terminal 1 — emulator (needs JDK >= 21 on PATH; brew's openjdk works)
PATH=/opt/homebrew/opt/openjdk/bin:$PATH \
  firebase emulators:start --only firestore --project demo-mg-mart-test --config ../../firebase.json

# terminal 2 — seed, then the server
export FIREBASE_PROJECT_ID=demo-mg-mart-test FIRESTORE_EMULATOR_HOST=localhost:8080
export JWT_SECRET="$(openssl rand -hex 16)"   # any value; it only signs this run's tokens
pnpm --filter @mg-mart/server seed:test -- --reset
PORT=5055 STORE_LAT=26.48872184 STORE_LNG=84.98157501 DELIVERY_RADIUS_KM=5 MIN_ORDER_VALUE=500 \
  DELIVERY_FEE_AMOUNT=40 DELIVERY_FEE_WAIVED_AT= HANDLING_FEE_AMOUNT=5 HANDLING_FEE_WAIVED_AT= \
  LEGACY_SHIPPING_STATE=Bihar \
  pnpm --filter @mg-mart/server exec tsx server.ts

# terminal 3 — the journey
pnpm --filter @mg-mart/server e2e -- --base-url http://localhost:5055
```

## 2. Deploy an isolated test instance

1. **Pick the Firestore target.** The seed loader refuses the production project outright, so the
   test service needs either its own Firebase project or a staging project loaded with
   `seed:test -- --allow-project`. Sharing the production project is not an option.
2. **Create a second Render web service** from this repo (branch `server`). Everything but the
   environment is already described by `render.yaml` at the repo root — that is the only deployment
   descriptor; the duplicate under `apps/server/` was removed because it carried a different
   `startCommand` and only one of the two was ever wired to a service.
3. **Set every variable marked `sync: false`**, including the eight the store configuration needs:

   | Variable | Test value | Note |
   |---|---|---|
   | `STORE_LAT` | `26.48872184` | the real shop |
   | `STORE_LNG` | `84.98157501` | the real shop |
   | `DELIVERY_RADIUS_KM` | `5` | hard radius |
   | `MIN_ORDER_VALUE` | `500` | |
   | `DELIVERY_FEE_AMOUNT` | `40` | **placeholder** — the real fee is undecided |
   | `DELIVERY_FEE_WAIVED_AT` | *(empty)* | empty means the fee always applies |
   | `HANDLING_FEE_AMOUNT` | `5` | **placeholder** |
   | `HANDLING_FEE_WAIVED_AT` | *(empty)* | |
   | `LEGACY_SHIPPING_STATE` | `Bihar` | admin-panel compatibility only |

   plus `JWT_SECRET`, `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_KEY` for the chosen project.
   The server validates all eight at startup and exits `1` on any missing or invalid value, so a
   deploy that is short one variable fails its health check instead of serving wrong prices.
4. **Load the catalog** against that project: `FIREBASE_PROJECT_ID=<test project> pnpm --filter
   @mg-mart/server seed:test -- --allow-project --reset`. This also creates the admin the journey
   logs in as, whose credentials `seed/catalog.v1.json` defines and the script reads from there.
5. **Run the journey** against the deployed URL:
   `pnpm --filter @mg-mart/server e2e -- --base-url https://<service>.onrender.com`.

The placeholder fee amounts do not weaken the result: the script derives every expected rupee from
the `appliedConfig` the deployment itself returns, so it passes on any legal configuration and fails
the moment the arithmetic stops agreeing with it.

## 3. What the journey asserts

Seventeen steps, in order, stopping at the first failure. Each run registers fresh customers, so it
is repeatable without a reset; the one catalogue change it makes (taking a product out of stock to
produce a flagged cart line) is undone before it exits.

| # | Step |
|---|---|
| 1 | `/health` answers and the seed catalog is loaded with the expected prices and exemptions |
| 2 | two customers register; the seed admin logs in and is really an admin |
| 3 | an address 1.5 km out saves as `serviceable`, is the default, and its `distanceKm` matches the Haversine distance from the configured store — which also proves the deployment's `STORE_LAT`/`STORE_LNG` |
| 4 | an address beyond the radius is **saved** (201), flagged `not_serviceable` / `OUTSIDE_RADIUS`, and does not steal the default |
| 5 | inactive and unavailable products are refused at `POST /cart/add` with `LINE_NOT_ORDERABLE` and the right `reason` |
| 6 | a below-minimum cart quotes with the exempt line excluded from `eligibleAmount`, the correct `shortfall`, and fees that match `appliedConfig` |
| 7 | a product that goes out of stock while in the cart keeps its line, flags it, blocks the quote, and refuses a quantity change |
| 8 | quoting against the far address blocks with `ADDRESS_NOT_SERVICEABLE` |
| 9 | another customer's `addressId` in a quote is `403 ADDRESS_NOT_OWNED` |
| 10 | fixing the cart makes the quote orderable and the total adds up |
| 11 | ordering to the far address is `422`, and the cart survives it |
| 12 | missing `idempotencyKey`, `paymentMethod: "Online"`, a malformed `addressId` and someone else's address are each rejected |
| 13 | a COD order is placed while the request lies about totals, items, status and `userId` — every forged field is ignored and the stored bill is the quoted bill, line for line |
| 14 | the same `idempotencyKey` replays to the same order; no second order exists |
| 15 | the owner reads the order; another customer gets `403`; anonymous gets `401`; `?userId=` does not widen a customer's list |
| 16 | a below-minimum cart and an empty cart are refused at order time even when the client claims the minimum is met |
| 17 | a customer cannot change a status, an admin can, an illegal transition is refused, and the bill does not move with the status |

Steps 4, 8, 11, 16 are the negative flow (out of radius, below minimum, lying client).

Exit codes: `0` passed · `1` a step failed · `2` the environment is unusable (no base URL, server
unreachable, catalog or seed admin missing). Options: `--seed` loads the catalog first (needs
datastore credentials, honours `--reset` and `--allow-project`); `E2E_STORE_LAT`/`E2E_STORE_LNG`,
`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`, `E2E_TIMEOUT_MS` and `E2E_BOOT_TIMEOUT_MS` (cold starts)
override the defaults.

## 4. Verified

2026-10-05, `server` + the shared-types commit, against a local server on the Firestore emulator
(JDK 23, seed catalog v1): 17/17 passed, twice in a row without a reset, and again with
`MIN_ORDER_VALUE=800`, `DELIVERY_FEE_AMOUNT=0`, `HANDLING_FEE_AMOUNT=7`, `HANDLING_FEE_WAIVED_AT=1000`
to confirm nothing is pinned to the placeholder amounts. `test:unit` 57/57 and `test:int` 75/75 still
pass. Not yet run against a deployment — no test service exists.
