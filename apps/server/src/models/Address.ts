import { Timestamp } from "firebase-admin/firestore";
import type { Serviceability } from "../domain/types.js";

/**
 * Customer delivery address.
 *
 * Stored at users/{uid}/addresses/{addressId}: ownership is the path.
 * Coordinates are required (captured from device GPS or a map pin — no
 * geocoding). `pincode` is optional and never gating. There is deliberately
 * no `city` / `state`, and NEVER an `isServiceable` field — serviceability is
 * computed on every read against current StoreConfig, not persisted.
 */
export interface CustomerAddress {
  addressId: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  landmark?: string;
  area: string;
  pincode?: string;
  lat: number;
  lng: number;
  accuracyM?: number;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AddressInput {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  landmark?: string;
  area: string;
  pincode?: string;
  lat: number;
  lng: number;
  accuracyM?: number;
}

/** Stored fields + computed serviceability (never persisted). */
export interface AddressResponse {
  addressId: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  landmark?: string;
  area: string;
  pincode?: string;
  lat: number;
  lng: number;
  accuracyM?: number;
  isDefault: boolean;
  serviceability: Serviceability;
  createdAt: string;
  updatedAt: string;
}
