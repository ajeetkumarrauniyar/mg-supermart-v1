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

  it("does not leak a library error's numeric code or string details", () => {
    // Shape of a real Firestore/gRPC failure: numeric code, details as a string.
    const firestoreError = Object.assign(
      new Error('3 INVALID_ARGUMENT: Resource id "__x__" is invalid because it is reserved.'),
      { code: 3, details: 'Resource id "__x__" is invalid because it is reserved.' }
    );

    const { status, body } = run(firestoreError);

    expect(status).toBe(500);
    expect(body.code).toBeUndefined();
    expect(body["0"]).toBeUndefined(); // no character-indexed spread
    expect(body["1"]).toBeUndefined();
    expect(Object.keys(body).every((k) => Number.isNaN(Number(k)))).toBe(true);
    // the internal message stays server-side
    expect(body.error).toBe("Internal Server Error");
    expect(JSON.stringify(body)).not.toContain("INVALID_ARGUMENT");
    expect(JSON.stringify(body)).not.toContain("reserved");
  });

  it("ignores a string code that is not one of the application's codes", () => {
    const { body } = run(
      Object.assign(new Error("boom"), { statusCode: 400, code: "SOMETHING_ELSE" })
    );
    expect(body.code).toBeUndefined();
  });

  it("ignores array and string details", () => {
    const withArray = run(
      Object.assign(new Error("boom"), { statusCode: 400, details: ["a", "b"] })
    );
    expect(withArray.body["0"]).toBeUndefined();
    const withString = run(
      Object.assign(new Error("boom"), { statusCode: 400, details: "leaky" })
    );
    expect(withString.body["0"]).toBeUndefined();
  });

  it("keeps the message of an application error that declares a 500", () => {
    const { status, body } = run(new ApiError("Store configuration is unavailable", 503, undefined, "CONFIG_UNAVAILABLE"));
    expect(status).toBe(503);
    expect(body.error).toBe("Store configuration is unavailable");
    expect(body.code).toBe("CONFIG_UNAVAILABLE");
  });

  it("maps ValidationError to 400 VALIDATION_ERROR naming the field", () => {
    const { status, body } = run(new ValidationError("lat is required", "lat"));
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.field).toBe("lat");
  });
});
