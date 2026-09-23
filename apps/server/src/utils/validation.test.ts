import { describe, it, expect } from "vitest";
import { validateId, validateCreateOrder, ValidationError } from "./validation.js";

describe("validateId (Firestore document-id safety)", () => {
  it("accepts auto-ids and UUIDs", () => {
    expect(validateId("AbC123xyz_-", "addressId")).toBe("AbC123xyz_-");
    expect(validateId(" 3f2504e0-4f89-11d3-9a0c-0305e82c3301 ", "idempotencyKey")).toBe(
      "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
    );
  });

  it.each(["..", ".", "a/b", "a/b/c", "__x__", "", "   ", "x".repeat(129), 42, null])(
    "rejects %j naming the field",
    (bad) => {
      expect(() => validateId(bad, "addressId")).toThrow(ValidationError);
      try {
        validateId(bad, "addressId");
      } catch (e) {
        expect((e as ValidationError).field).toBe("addressId");
      }
    }
  );
});

describe("validateCreateOrder", () => {
  it("passes a well-formed body through", () => {
    expect(validateCreateOrder({ addressId: "addr1", paymentMethod: "COD", idempotencyKey: "k-1" })).toEqual({
      addressId: "addr1",
      paymentMethod: "COD",
      idempotencyKey: "k-1",
    });
  });

  it("leaves the missing-key case to the controller (empty string) but rejects a malformed key", () => {
    expect(validateCreateOrder({ addressId: "addr1", paymentMethod: "COD" }).idempotencyKey).toBe("");
    expect(() => validateCreateOrder({ addressId: "addr1", paymentMethod: "COD", idempotencyKey: "a/b" })).toThrow(
      /idempotencyKey is not a valid id/
    );
    expect(() => validateCreateOrder({ addressId: "a/b", paymentMethod: "COD", idempotencyKey: "k" })).toThrow(
      /addressId is not a valid id/
    );
  });
});
