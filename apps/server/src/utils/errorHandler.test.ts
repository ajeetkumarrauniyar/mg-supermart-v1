import { describe, it, expect, vi } from "vitest";
import { ApiError, errorHandler } from "./errorHandler.js";
import { ValidationError } from "./validation.js";

const run = (err: Error) => {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) } as any;
  const req = { url: "/x", method: "GET" } as any;
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  errorHandler(err as ApiError, req, res, vi.fn());
  spy.mockRestore();
  return { status: res.status.mock.calls[0]?.[0] as number, body: json.mock.calls[0]?.[0] };
};

describe("ApiError code serialisation", () => {
  it("emits {success,error,field,code} when a code is set", () => {
    const { status, body } = run(
      new ApiError("Address is outside the delivery radius", 422, undefined, "ADDRESS_NOT_SERVICEABLE")
    );
    expect(status).toBe(422);
    expect(body).toEqual({
      success: false,
      error: "Address is outside the delivery radius",
      field: undefined,
      code: "ADDRESS_NOT_SERVICEABLE",
    });
  });

  it("leaves legacy errors without a code unchanged", () => {
    const { status, body } = run(new ApiError("Order not found", 404));
    expect(status).toBe(404);
    expect(body).toEqual({ success: false, error: "Order not found", field: undefined });
    expect("code" in body).toBe(false);
  });

  it("spreads structured details (e.g. blockers) into the envelope", () => {
    const { body } = run(
      new ApiError("Cart cannot be ordered", 422, undefined, "ORDER_BELOW_MINIMUM", {
        blockers: [{ code: "ORDER_BELOW_MINIMUM" }],
      })
    );
    expect(body.code).toBe("ORDER_BELOW_MINIMUM");
    expect(body.blockers).toEqual([{ code: "ORDER_BELOW_MINIMUM" }]);
  });

  it("maps ValidationError to 400 VALIDATION_ERROR naming the field", () => {
    const { status, body } = run(new ValidationError("lat is required", "lat"));
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.field).toBe("lat");
  });
});
