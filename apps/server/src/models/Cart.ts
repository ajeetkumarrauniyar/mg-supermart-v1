import { Timestamp } from "firebase-admin/firestore";
import type { LineBlockerReason } from "../domain/types.js";

export interface CartItem {
  productId: string;
  quantity: number;
  addedAt: Timestamp;
}

export interface CartItemWithProduct {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  unit: string;
  quantity: number;
  addedAt: Timestamp;
  /** Derived per D-013; lines are kept and flagged, never silently removed. */
  isOrderable: boolean;
  minOrderExempt: boolean;
  blocker?: LineBlockerReason;
}

export interface AddToCartInput {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

export interface CartItemResponse {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  unit: string;
  quantity: number;
  addedAt: string;
  isOrderable: boolean;
  minOrderExempt: boolean;
  blocker?: LineBlockerReason;
}

export interface CartResponse {
  items: CartItemResponse[];
  totalItems: number;
  totalAmount: number;
}
