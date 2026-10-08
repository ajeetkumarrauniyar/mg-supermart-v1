import { create } from "zustand";
import type { Quote } from "@mg-mart/types";
import { cartService } from "../services";

/**
 * The server's bill for the current cart.
 *
 * Fees, the minimum order value and the waiver thresholds are store
 * configuration and exist only on the server, so the app never computes or
 * caches them: a quote is fetched, rendered, and discarded when the cart
 * changes. Nothing here is persisted — a stale bill from the last session
 * would be a wrong price, not a cheap one.
 */

export type QuoteStatus = "idle" | "loading" | "ready" | "error";

export interface QuoteStore {
  quote: Quote | null;
  status: QuoteStatus;
  error: string | null;

  /** Fetches a fresh bill, debounced so quantity taps do not each cost a call. */
  refresh: (addressId?: string) => void;
  /** Fetches immediately, bypassing the debounce (screen focus, manual retry). */
  refreshNow: (addressId?: string) => Promise<void>;
  /** Drops the current bill, e.g. when the cart empties or the user logs out. */
  clear: () => void;
}

const DEBOUNCE_MS = 400;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
// Only the newest request may write to the store; a slow earlier response that
// lands late would otherwise show a price for a cart that no longer exists.
let latestRequestId = 0;

export const useQuoteStore = create<QuoteStore>()((set) => {
  const fetchQuote = async (addressId?: string) => {
    const requestId = ++latestRequestId;
    set({ status: "loading", error: null });

    try {
      const quote = await cartService.quote(addressId);
      if (requestId !== latestRequestId) return;
      set({ quote, status: "ready", error: null });
    } catch (error: unknown) {
      if (requestId !== latestRequestId) return;
      // Without a bill there is no price to show. Falling back to a hardcoded
      // fee would silently disagree with what the order is actually charged.
      const message =
        error instanceof Error ? error.message : "Could not load the bill";
      set({ quote: null, status: "error", error: message });
    }
  };

  return {
    quote: null,
    status: "idle",
    error: null,

    refresh: (addressId?: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void fetchQuote(addressId);
      }, DEBOUNCE_MS);
    },

    refreshNow: async (addressId?: string) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      await fetchQuote(addressId);
    },

    clear: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      // Invalidate any in-flight request so its response cannot revive the bill.
      latestRequestId++;
      set({ quote: null, status: "idle", error: null });
    },
  };
});

export default useQuoteStore;
