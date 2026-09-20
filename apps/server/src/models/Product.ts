import { Timestamp } from "firebase-admin/firestore";

export type ProductCategory =
  | "Fruits & Vegetables"
  | "Dairy & Eggs"
  | "Bakery"
  | "Meat & Seafood"
  | "Pantry"
  | "Beverages"
  | "Snacks"
  | "Frozen"
  | "Personal Care"
  | "Household";

export type ProductUnit =
  | "kg"
  | "liter"
  | "piece"
  | "gram"
  | "ml"
  | "dozen"
  | "pack";

export interface Product {
  productId: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  // True once an admin has manually set/changed this product's category
  // via the admin panel. When true, the BUSY sync script must NOT
  // silently overwrite category on the next sync — it must queue the
  // BUSY-side value for review instead. See working-sync.js.
  categoryManuallySet?: boolean;
  imageUrl: string;
  stock: number;
  unit: ProductUnit;
  isFeatured: boolean;
  /** Maximum retail price; BUSY sync writes mrp = price today. Informational. */
  mrp?: number;
  // Admin-owned catalogue flags (D-013). Optional on the stored document because
  // existing products predate them; the server normalises missing values to
  // isActive=true, isAvailable=true, minOrderExempt=false. These three fields
  // must never appear in the BUSY sync payload (merge:true keeps them intact).
  /** Listed in the customer catalogue at all. false ⇒ hidden, cannot be carted. */
  isActive?: boolean;
  /** The shop can supply it right now (ADM-08 "mark out of stock"). */
  isAvailable?: boolean;
  /** Excluded from the ₹500 eligible amount (D-002). */
  minOrderExempt?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  imageUrl: string;
  stock: number;
  unit: ProductUnit;
  isFeatured?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  category?: ProductCategory;
  categoryManuallySet?: boolean;
  imageUrl?: string;
  stock?: number;
  unit?: ProductUnit;
  isFeatured?: boolean;
  mrp?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  minOrderExempt?: boolean;
}

export interface ProductResponse {
  productId: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  categoryManuallySet?: boolean;
  imageUrl: string;
  stock: number;
  unit: ProductUnit;
  isFeatured: boolean;
  mrp?: number;
  isActive: boolean;
  isAvailable: boolean;
  minOrderExempt: boolean;
  /** Derived (isActive && isAvailable) — never persisted (D-013). */
  isOrderable: boolean;
  createdAt: string;
  updatedAt: string;
}