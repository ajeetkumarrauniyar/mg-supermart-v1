/**
 * QuoteService (D-012 §6, D-014 §4).
 *
 * Assembles bill lines from the cart + products, resolves the address to a
 * serviceability, and calls the pure computeBill. The SAME buildLines /
 * assemble path is used by POST /cart/quote (plain reads) and by POST /orders
 * (reads inside the Firestore transaction), so quote and order always agree.
 */
import type { DocumentSnapshot, Firestore, Transaction } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "../services/firebase.js";
import { ADDRESSES_SUBCOLLECTION } from "../repositories/AddressRepository.js";
import { computeBill } from "../domain/bill.js";
import { computeServiceability } from "../domain/serviceability.js";
import { lineBlocker, normalizeProductFlags } from "../domain/orderability.js";
import type { Bill, BillLineInput, Serviceability, StoreConfig } from "../domain/types.js";
import type { CustomerAddress } from "../models/Address.js";
import type { CartItem } from "../models/Cart.js";
import type { Product } from "../models/Product.js";

export interface CartLineRead {
  productId: string;
  quantity: number;
}

/** Reader abstraction so the same code runs with or without a transaction. */
interface Reader {
  get(ref: FirebaseFirestore.DocumentReference): Promise<DocumentSnapshot>;
  getAll(refs: FirebaseFirestore.DocumentReference[]): Promise<DocumentSnapshot[]>;
  query(q: FirebaseFirestore.Query): Promise<FirebaseFirestore.QuerySnapshot>;
}

const plainReader = (db: Firestore): Reader => ({
  get: (ref) => ref.get(),
  getAll: (refs) => (refs.length === 0 ? Promise.resolve([]) : db.getAll(...refs)),
  query: (q) => q.get(),
});

const txReader = (tx: Transaction): Reader => ({
  get: (ref) => tx.get(ref),
  getAll: (refs) => (refs.length === 0 ? Promise.resolve([]) : tx.getAll(...refs)),
  query: (q) => tx.get(q),
});

export interface AssembledQuote {
  /** null when no address was selected and none is default (ADDRESS_REQUIRED). */
  address: CustomerAddress | null;
  serviceability: Serviceability | null;
  lines: BillLineInput[];
  bill: Bill;
  cartRefs: FirebaseFirestore.DocumentReference[];
}

/** Builds bill lines from cart docs and product docs (missing product ⇒ blocked line). */
export const buildLines = (
  cart: CartLineRead[],
  products: Map<string, Product | null>
): BillLineInput[] =>
  cart.map((item) => {
    const product = products.get(item.productId) ?? null;
    if (!product) {
      return {
        productId: item.productId,
        name: item.productId,
        unitPrice: 0,
        quantity: item.quantity,
        minOrderExempt: false,
        isOrderable: false,
        blocker: "INACTIVE",
      };
    }
    const flags = normalizeProductFlags(product);
    const blocker = lineBlocker(flags);
    return {
      productId: product.productId,
      name: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
      minOrderExempt: flags.minOrderExempt,
      isOrderable: blocker === null,
      ...(blocker !== null && { blocker }),
    };
  });

export class QuoteService {
  private db = getDb();

  /**
   * Reads cart, products and the address (explicit id, else the default) and
   * computes the bill. Pass `tx` to perform every read inside a transaction.
   * Throws "ADDRESS_NOT_OWNED" when an explicit addressId is not the user's.
   */
  async assemble(
    userId: string,
    addressId: string | undefined,
    config: StoreConfig,
    tx?: Transaction
  ): Promise<AssembledQuote> {
    const reader = tx ? txReader(tx) : plainReader(this.db);
    const userRef = this.db.collection(COLLECTIONS.USERS).doc(userId);

    // 1. cart lines
    const cartSnap = await reader.query(userRef.collection(COLLECTIONS.CART));
    const cart: CartLineRead[] = cartSnap.docs.map((d) => ({
      productId: d.id,
      quantity: (d.data() as CartItem).quantity,
    }));
    const cartRefs = cartSnap.docs.map((d) => d.ref);

    // 2. products (server-authoritative price + flags)
    const productRefs = cart.map((c) => this.db.collection(COLLECTIONS.PRODUCTS).doc(c.productId));
    const productSnaps = await reader.getAll(productRefs);
    const products = new Map<string, Product | null>();
    productSnaps.forEach((snap, i) => {
      products.set(cart[i]!.productId, snap.exists ? (snap.data() as Product) : null);
    });

    // 3. address: explicit id (must be owned) or the default
    let address: CustomerAddress | null = null;
    const addresses = userRef.collection(ADDRESSES_SUBCOLLECTION);
    if (addressId) {
      const snap = await reader.get(addresses.doc(addressId));
      if (!snap.exists) {
        throw new AddressNotOwnedError(addressId);
      }
      address = snap.data() as CustomerAddress;
    } else {
      const snap = await reader.query(addresses.where("isDefault", "==", true).limit(1));
      address = snap.empty ? null : (snap.docs[0]!.data() as CustomerAddress);
    }

    const serviceability = address
      ? computeServiceability({ lat: address.lat, lng: address.lng }, config)
      : null;

    const lines = buildLines(cart, products);
    const bill = computeBill(lines, config, serviceability);

    return { address, serviceability, lines, bill, cartRefs };
  }
}

export class AddressNotOwnedError extends Error {
  constructor(public readonly addressId: string) {
    super(`Address ${addressId} not found for this account`);
    this.name = "AddressNotOwnedError";
  }
}

/** What the API returns when no address is selected (D-012 §6: unknown + ADDRESS_REQUIRED). */
export const noAddressServiceability = (config: StoreConfig): Serviceability => ({
  status: "unknown",
  distanceKm: null,
  radiusKm: config.deliveryRadiusKm,
  reason: "NO_COORDINATES",
});
