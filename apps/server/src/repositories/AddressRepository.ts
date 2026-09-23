/**
 * Address Repository.
 *
 * Addresses live in the subcollection users/{uid}/addresses so every read and
 * write is scoped to the owner by path. The repository stores facts only; the
 * controller attaches computed serviceability.
 */
import {
  getDb,
  COLLECTIONS,
  createTimestamp,
  timestampToString,
} from "../services/firebase.js";
import type { AddressInput, CustomerAddress } from "../models/Address.js";

/** Subcollection name under users/{uid}. */
export const ADDRESSES_SUBCOLLECTION = "addresses";

/** Stored address with string timestamps; serviceability is added by the caller. */
export type StoredAddress = Omit<CustomerAddress, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export class AddressRepository {
  private db = getDb();

  private collection(userId: string) {
    return this.db
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(ADDRESSES_SUBCOLLECTION);
  }

  async create(userId: string, input: AddressInput): Promise<StoredAddress> {
    const col = this.collection(userId);
    const addressId = col.doc().id;
    const now = createTimestamp();

    // The first address a customer saves becomes the default
    const existing = await col.limit(1).get();
    const isDefault = existing.empty;

    const doc: CustomerAddress = {
      addressId,
      userId,
      ...input,
      isDefault,
      createdAt: now,
      updatedAt: now,
    };

    await col.doc(addressId).set(doc);
    return this.toStored(doc);
  }

  async findById(userId: string, addressId: string): Promise<StoredAddress | null> {
    const snap = await this.collection(userId).doc(addressId).get();
    if (!snap.exists) return null;
    return this.toStored(snap.data() as CustomerAddress);
  }

  async list(userId: string): Promise<StoredAddress[]> {
    const snap = await this.collection(userId).get();
    const items = snap.docs.map((d) => this.toStored(d.data() as CustomerAddress));
    // default first, then newest first
    items.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return items;
  }

  async update(
    userId: string,
    addressId: string,
    input: AddressInput
  ): Promise<StoredAddress | null> {
    const ref = this.collection(userId).doc(addressId);
    const snap = await ref.get();
    if (!snap.exists) return null;

    const current = snap.data() as CustomerAddress;
    // Optional fields omitted from the input are cleared, not kept stale:
    // `input` is a validated AddressInput whose optional keys are absent when unset.
    const next: CustomerAddress = {
      addressId,
      userId,
      label: input.label,
      recipientName: input.recipientName,
      phone: input.phone,
      line1: input.line1,
      ...(input.landmark !== undefined && { landmark: input.landmark }),
      area: input.area,
      ...(input.pincode !== undefined && { pincode: input.pincode }),
      lat: input.lat,
      lng: input.lng,
      ...(input.accuracyM !== undefined && { accuracyM: input.accuracyM }),
      isDefault: current.isDefault,
      createdAt: current.createdAt,
      updatedAt: createTimestamp(),
    };

    await ref.set(next);
    return this.toStored(next);
  }

  async delete(userId: string, addressId: string): Promise<boolean> {
    const ref = this.collection(userId).doc(addressId);
    const snap = await ref.get();
    if (!snap.exists) return false;

    const wasDefault = (snap.data() as CustomerAddress).isDefault;
    await ref.delete();

    // Promote the newest remaining address so there is always a default
    if (wasDefault) {
      const rest = await this.collection(userId).get();
      if (!rest.empty) {
        const newest = rest.docs
          .map((d) => d.data() as CustomerAddress)
          .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];
        if (newest) {
          await this.collection(userId)
            .doc(newest.addressId)
            .update({ isDefault: true, updatedAt: createTimestamp() });
        }
      }
    }
    return true;
  }

  async setDefault(userId: string, addressId: string): Promise<StoredAddress | null> {
    const col = this.collection(userId);
    const target = await col.doc(addressId).get();
    if (!target.exists) return null;

    const all = await col.get();
    const batch = this.db.batch();
    const now = createTimestamp();
    all.docs.forEach((d) => {
      batch.update(d.ref, { isDefault: d.id === addressId, updatedAt: now });
    });
    await batch.commit();

    return this.toStored({ ...(target.data() as CustomerAddress), isDefault: true, updatedAt: now });
  }

  /** Returns the default address, or null when the user has none. */
  async findDefault(userId: string): Promise<StoredAddress | null> {
    const snap = await this.collection(userId).where("isDefault", "==", true).limit(1).get();
    if (snap.empty) return null;
    return this.toStored(snap.docs[0]!.data() as CustomerAddress);
  }

  private toStored(doc: CustomerAddress): StoredAddress {
    return {
      ...doc,
      createdAt: timestampToString(doc.createdAt),
      updatedAt: timestampToString(doc.updatedAt),
    };
  }
}
