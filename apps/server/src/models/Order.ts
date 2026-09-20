import { Timestamp } from "firebase-admin/firestore";
import { Address } from "./User.js";
import type { AppliedConfig, Bill } from "../domain/types.js";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "COD" | "Online";

/** Stored from day one so online payment can be added without reshaping orders (D-005). */
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

/**
 * One order line. `price`/`name` are the legacy fields the admin panel reads;
 * `unitPrice`, `lineTotal` and `minOrderExempt` are the D-014 §5 snapshots.
 */
export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  minOrderExempt?: boolean;
}

export interface PaymentDetails {
  paymentMethod: PaymentMethod;
  transactionId?: string;
}

/** Copy of the address as it was at order time, plus the serviceability facts (D-003, D-012 §8). */
export interface AddressSnapshot {
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
  distanceKm: number | null;
  radiusKm: number;
}

/**
 * Order document. Additive on top of the legacy shape (D-005): `items`,
 * `totalAmount` (= bill.total) and `shippingAddress` keep the admin panel
 * working; the new fields make the order self-contained and explainable.
 */
export interface Order {
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: Address;
  paymentDetails: PaymentDetails;
  paymentStatus?: PaymentStatus;
  bill?: Bill;
  appliedConfig?: AppliedConfig;
  addressSnapshot?: AddressSnapshot;
  idempotencyKey?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Request body for POST /orders (D-004, D-012 §7, D-014 §5). */
export interface CreateOrderRequest {
  addressId: string;
  paymentMethod: "COD";
  idempotencyKey: string;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  paymentDetails?: PaymentDetails;
}

export interface OrderResponse {
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: Address;
  paymentDetails: PaymentDetails;
  paymentStatus?: PaymentStatus;
  bill?: Bill;
  appliedConfig?: AppliedConfig;
  addressSnapshot?: AddressSnapshot;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}
