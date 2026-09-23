# MG Supermart API — cart, checkout and catalogue

Reference for the customer-facing ordering API: products, cart, addresses, the
quote that prices a cart, and order creation.

**Base URL:** `/api/v1` (Express `app.use("/api", …)` + `routes/index.ts` `router.use("/v1/<feature>", …)`).
**Auth:** `Authorization: Bearer <JWT>` from `POST /auth/register` / `POST /auth/login`.
**Source of truth:** every rule — the ₹500 minimum, its exemptions, fees, serviceability and totals — is
computed server-side and returned as a *quote*. Clients render that result and never re-derive a rule,
so the cart, the checkout screen and the stored order can never disagree.
**Examples:** every example below was produced by `src/test/contract-examples.int.test.ts` running against
the Firestore emulator and the seed catalog; the full set is in `api-contract-m1.examples.json`.
Volatile values (ids, timestamps) are replaced with placeholders.

---

## 1. Error envelope

Every error is `{ success: false, error: string, field?: string, code?: string, …details }`.
`code` is optional; older errors that predate it are unchanged. When present it is always one of the
values below — codes and structured details coming from libraries are never passed through, and an
unexpected internal failure answers `500 { success: false, error: "Internal Server Error" }` with no
`code`, no details and no internal message.

| code | HTTP | Where |
|---|---|---|
| `VALIDATION_ERROR` | 400 | any malformed input; `field` names the offending field, typed input is never erased |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | `POST /orders` without `idempotencyKey` |
| `FORBIDDEN` | 403 | `includeInactive=1` without an admin token |
| `ADDRESS_NOT_OWNED` | 403 | any `addressId` that is not the caller's (addresses, quote, orders) |
| `NOT_FOUND` | 404 | product not found, or inactive for a customer |
| `VALIDATION_ERROR` | 400 | `:productId` that is not a legal document id (charset, length, or a reserved `__x__` form) |
| `LINE_NOT_ORDERABLE` | 422 | cart add/update of a non-orderable product (`reason: INACTIVE\|UNAVAILABLE`); order creation |
| `ORDER_BELOW_MINIMUM` | 422 | order creation |
| `ADDRESS_NOT_SERVICEABLE` | 422 | order creation |
| `ADDRESS_REQUIRED` | 422 | order creation (never reached in practice — `addressId` is required by validation) |
| `CART_EMPTY` | 422 | order creation |
| `CONFIG_UNAVAILABLE` | 503 | store configuration missing/invalid (addresses, quote, orders) |

A `422` from `POST /orders` carries `code` = the first blocker and the full `blockers[]` (plus `serviceability`).

## 2. Products

Every product response carries the persisted flags and the derived verdict:

```json
{ "isActive": true, "isAvailable": true, "minOrderExempt": true, "isOrderable": true, "mrp": 45, "stock": 50 }
```

- `isOrderable = isActive && isAvailable` — derived on every read, **never stored**. `stock` is informational: the catalogue's stock figures come from the ERP sync and are not yet trustworthy, so they do not gate ordering.
- Missing flags on old documents read as `true / true / false`.
- `GET /products` (customer / anonymous): excludes `isActive=false`. The filter runs in memory after the Firestore query, so a page may contain fewer than `limit` products when inactive documents fall inside it — treat page sizes as approximate. `?inStock=true` means `isOrderable`.
- `GET /products?includeInactive=1` — admin token only (403 `FORBIDDEN` otherwise).
- `GET /products/:id` — `404 NOT_FOUND` for customers when `isActive=false`; admins see it.
- `PUT /products/:id` (admin) accepts `isActive`, `isAvailable`, `minOrderExempt` (booleans) and `mrp`.

`GET /api/v1/products/SEED-SUGAR-1KG → 200`
```json
{ "success": true, "data": { "productId": "SEED-SUGAR-1KG", "name": "Sugar 1 kg", "price": 45, "mrp": 45, "category": "Pantry", "stock": 50, "unit": "kg", "isFeatured": false, "isActive": true, "isAvailable": true, "minOrderExempt": true, "isOrderable": true, "…": "…" } }
```

## 3. Cart

| Method & path | Notes |
|---|---|
| `GET /cart` | lines carry `isOrderable`, `minOrderExempt`, `blocker?` — non-orderable lines are **kept and flagged**, never dropped |
| `GET /cart/count` | `{ itemCount }` |
| `POST /cart/add { productId, quantity }` | `422 LINE_NOT_ORDERABLE { reason }` for non-orderable products; stock is not checked |
| `PUT /cart/items/:productId { quantity }` | **canonical** (what the mobile app calls) |
| `DELETE /cart/items/:productId` | **canonical** |
| `PUT /cart/update/:productId`, `DELETE /cart/remove/:productId` | deprecated aliases, kept for existing clients |
| `DELETE /cart/clear` | unchanged |
| `POST /cart/quote { addressId? }` | see §5 |

Prices are server-authoritative: any client-supplied `price` is ignored.

`POST /api/v1/cart/add (not orderable) → 422`
```json
{ "success": false, "error": "Paneer 200 g (not available) is not available right now", "field": "productId", "code": "LINE_NOT_ORDERABLE", "reason": "UNAVAILABLE", "productId": "SEED-UNAVAIL-PANEER" }
```

## 4. Addresses

Stored at `users/{uid}/addresses/{addressId}`; ownership is the path. All routes require a token.

| Method & path | Response |
|---|---|
| `GET /addresses` | `data: AddressResponse[]` — default first; each with fresh `serviceability` |
| `POST /addresses` | `201` **always** for a well-formed address, even outside the radius |
| `PUT /addresses/:id` | `200`; omitted optional fields are cleared |
| `DELETE /addresses/:id` | `200`; deleting the default promotes the newest remaining address |
| `PUT /addresses/:id/default` | `200` |

Body (`AddressInput`): `label`, `recipientName`, `phone`, `line1`, `landmark?`, `area`, `pincode?` (6 digits, never gating), **`lat`, `lng` (required)**, `accuracyM?`.
There is no `city`/`state`, and `isServiceable` is never stored — `serviceability` is computed against current `StoreConfig` on every read:

```ts
Serviceability = { status: "serviceable" | "not_serviceable" | "unknown"; distanceKm: number | null; radiusKm: number; reason?: "OUTSIDE_RADIUS" | "NO_COORDINATES" }
```

`POST /api/v1/addresses → 201`
```json
{ "success": true, "message": "Address saved", "data": { "addressId": "ADDRESS_ID", "label": "Home", "recipientName": "Sita Devi", "phone": "9876543210", "line1": "Ward 4, near Shiv Mandir", "landmark": "Opp. primary school", "area": "Pipra Bazar", "pincode": "845416", "lat": 26.506435, "lng": 84.985065, "accuracyM": 12, "isDefault": true, "createdAt": "…", "updatedAt": "…", "serviceability": { "status": "serviceable", "distanceKm": 2, "radiusKm": 5 } } }
```

`POST /api/v1/addresses (7 km away) → 201`
```json
{ "success": true, "message": "Address saved", "data": { "…": "…", "isDefault": false, "serviceability": { "status": "not_serviceable", "distanceKm": 7, "radiusKm": 5, "reason": "OUTSIDE_RADIUS" } } }
```

`POST /api/v1/addresses (missing fields) → 400`
```json
{ "success": false, "error": "phone is required", "field": "phone", "code": "VALIDATION_ERROR" }
```

## 5. Quote — `POST /cart/quote { addressId? }`

Always `200` (a quote is a report, never an error) except `503 CONFIG_UNAVAILABLE` and `403 ADDRESS_NOT_OWNED`.
`addressId` defaults to the caller's default address; with none: `serviceability.status = "unknown"` and blocker `ADDRESS_REQUIRED`.

```ts
data = {
  addressId: string | null,
  serviceability: Serviceability,
  bill: Bill,               // see below
  orderable: boolean,       // === bill.orderable
  blockers: Blocker[],      // === bill.blockers
}
Bill = {
  lines: { productId, name, unitPrice, quantity, lineTotal, minOrderExempt, isOrderable, blocker? }[],
  subtotal, eligibleAmount, minOrderValue, minOrderMet, shortfall,
  deliveryFee, handlingFee, total,          // total === subtotal + deliveryFee + handlingFee (integer rupees)
  orderable, blockers,
  appliedConfig: { minOrderValue, deliveryFee: FeeRule, handlingFee: FeeRule, deliveryRadiusKm }
}
FeeRule = { amount: number; waivedAtOrAbove: number | null }   // waiver threshold is on subtotal
Blocker = { code, message, productId?, reason?, shortfall?, distanceKm?, radiusKm? }
```

Rules: `eligibleAmount` excludes `minOrderExempt` lines; `minOrderMet = eligibleAmount >= minOrderValue`;
a fee applies iff `amount > 0 && (waivedAtOrAbove === null || subtotal < waivedAtOrAbove)`.

`POST /api/v1/cart/quote (orderable) → 200`
```json
{ "success": true, "data": { "addressId": "ADDRESS_ID", "serviceability": { "status": "serviceable", "distanceKm": 2, "radiusKm": 5 }, "bill": { "lines": [ { "productId": "SEED-ATTA-5KG", "name": "Chakki Atta 5 kg", "unitPrice": 180, "quantity": 1, "minOrderExempt": false, "isOrderable": true, "lineTotal": 180 }, { "productId": "SEED-OIL-MUSTARD-1L", "name": "Mustard Oil 1 L", "unitPrice": 180, "quantity": 1, "minOrderExempt": true, "isOrderable": true, "lineTotal": 180 }, { "productId": "SEED-RICE-5KG", "name": "Sona Masoori Rice 5 kg", "unitPrice": 320, "quantity": 1, "minOrderExempt": false, "isOrderable": true, "lineTotal": 320 } ], "subtotal": 680, "eligibleAmount": 500, "minOrderValue": 500, "minOrderMet": true, "shortfall": 0, "deliveryFee": 40, "handlingFee": 5, "total": 725, "orderable": true, "blockers": [], "appliedConfig": { "minOrderValue": 500, "deliveryFee": { "amount": 40, "waivedAtOrAbove": null }, "handlingFee": { "amount": 5, "waivedAtOrAbove": null }, "deliveryRadiusKm": 5 } }, "orderable": true, "blockers": [] } }
```

Below-minimum and unserviceable examples: see `api-contract-m1.examples.json`
(`"POST /api/v1/cart/quote (below minimum) → 200"`, `"… (unserviceable address) → 200"`).

## 6. Orders

### `POST /orders { addressId, paymentMethod: "COD", idempotencyKey }`

- Runs in **one Firestore transaction**: reads the idempotency record, cart, products and the *stored* address;
  recomputes serviceability from stored coordinates and the bill with the same `computeBill` the quote used;
  writes the order, the idempotency record and deletes the cart lines. No stock is read for orderability or written.
- `201` with the order. **Replay** with the same `idempotencyKey` ⇒ `200 { replayed: true, data: <original order> }`.
- Any blocker ⇒ `422 { code: <first blocker>, blockers: [...], serviceability }`, nothing written, cart intact.
- `paymentMethod` must be `"COD"`; `"Online"` is reserved for a later payment integration and is rejected with 400. `idempotencyKey` is client-generated (UUID).
- **Id format:** `addressId` and `idempotencyKey` must match `^[A-Za-z0-9_-]{1,128}$` (Firestore auto-ids and UUIDs do); anything else ⇒ `400 VALIDATION_ERROR` naming the field. The same rule applies to `:addressId` path params and `quote.addressId`.

Order shape (additive over the legacy shape the admin panel reads — `items[].price`, `totalAmount`, `shippingAddress`):

```ts
Order = {
  orderId, userId, status: "pending" | "processing" | "shipped" | "delivered" | "cancelled",
  items: { productId, name, price, quantity, unitPrice, lineTotal, minOrderExempt }[],
  totalAmount,                       // === bill.total
  paymentDetails: { paymentMethod: "COD" }, paymentStatus: "pending",
  bill: Bill, appliedConfig,         // exactly what the quote showed
  addressSnapshot: { addressId, label, recipientName, phone, line1, landmark?, area, pincode?, lat, lng, accuracyM?, distanceKm, radiusKm },
  shippingAddress: { street, city, state, zipCode },   // legacy, derived — see below
  idempotencyKey, createdAt, updatedAt
}
```

**Legacy `shippingAddress` mapping** (read-only, derived at order time; `addressSnapshot` is authoritative):
`street ← line1 + ", " + landmark`, `city ← area`, `zipCode ← pincode ?? ""`,
`state ← LEGACY_SHIPPING_STATE` env (compatibility value, not a business rule; empty allowed).

`POST /api/v1/orders → 201`
```json
{ "success": true, "message": "Order created successfully", "data": { "orderId": "ORDER_ID", "userId": "USER_ID", "items": [ { "productId": "SEED-ATTA-5KG", "name": "Chakki Atta 5 kg", "price": 180, "quantity": 1, "unitPrice": 180, "lineTotal": 180, "minOrderExempt": false }, "…" ], "totalAmount": 725, "status": "pending", "shippingAddress": { "street": "Ward 4, near Shiv Mandir, Opp. primary school", "city": "Pipra Bazar", "state": "Bihar", "zipCode": "845416" }, "paymentDetails": { "paymentMethod": "COD" }, "paymentStatus": "pending", "bill": { "…": "identical to the quote's bill" }, "appliedConfig": { "…": "…" }, "addressSnapshot": { "addressId": "ADDRESS_ID", "label": "Home", "line1": "Ward 4, near Shiv Mandir", "area": "Pipra Bazar", "pincode": "845416", "lat": 26.506435, "lng": 84.985065, "distanceKm": 2, "radiusKm": 5, "…": "…" }, "idempotencyKey": "client-generated-uuid", "createdAt": "…", "updatedAt": "…" } }
```

`POST /api/v1/orders (blocked) → 422`
```json
{ "success": false, "error": "Your cart is empty", "code": "CART_EMPTY", "blockers": [ { "code": "CART_EMPTY", "message": "Your cart is empty" } ], "serviceability": { "status": "serviceable", "distanceKm": 2, "radiusKm": 5 } }
```

`POST /api/v1/orders (missing idempotencyKey) → 400`
```json
{ "success": false, "error": "idempotencyKey is required so retries do not create duplicate orders", "field": "idempotencyKey", "code": "IDEMPOTENCY_KEY_REQUIRED" }
```

### Other order routes (B1)

| Method & path | Customer token | Admin token |
|---|---|---|
| `GET /orders?status=&limit=&offset=` | **own orders only** (`userId` query ignored) | all orders, `status`/`userId` filters |
| `GET /orders/:id` | own only (403 otherwise) | any |
| `PUT /orders/:id/cancel` | own only, `pending`/`processing` | any |
| `PUT /orders/:id/status { status }` | **403** | transition table enforced |

## 7. Environment variables

| Var | Required | Meaning |
|---|---|---|
| `STORE_LAT`, `STORE_LNG` | yes | store coordinates |
| `DELIVERY_RADIUS_KM` | yes | hard straight-line radius (5) |
| `MIN_ORDER_VALUE` | yes | ₹500 |
| `DELIVERY_FEE_AMOUNT`, `DELIVERY_FEE_WAIVED_AT` | yes / may be empty | `FeeRule`; empty waiver = always applies |
| `HANDLING_FEE_AMOUNT`, `HANDLING_FEE_WAIVED_AT` | yes / may be empty | `FeeRule` |
| `LEGACY_SHIPPING_STATE` | no | admin-panel `shippingAddress.state` compat value only |
| `JWT_SECRET`, `FIREBASE_PROJECT_ID` | yes | unchanged |

The server **refuses to start** if a required var is missing or invalid; quote/order return `503 CONFIG_UNAVAILABLE`.
The ₹40 / ₹5 values in `.env.example` are **placeholders**: the real fees have not been decided and must be set explicitly per environment.

## 8. Running the backend tests

```
pnpm --filter @mg-mart/server test:unit    # pure domain/config tests
pnpm --filter @mg-mart/server test:int     # Firestore emulator (needs JDK ≥ 21 on PATH)
pnpm --filter @mg-mart/server seed:test    # load seed/catalog.v1.json into the emulator (or staging with --allow-project)
```

`seed:test` needs `FIRESTORE_EMULATOR_HOST` (set automatically under `firebase emulators:exec`) **and**
`FIREBASE_PROJECT_ID` (any value with the emulator, e.g. `demo-mg-mart-test`; `services/firebase.ts` requires it).
The emulator needs a JDK ≥ 21 on `PATH`.
