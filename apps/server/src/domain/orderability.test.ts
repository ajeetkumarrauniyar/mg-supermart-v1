import { describe, it, expect } from "vitest";
import { normalizeProductFlags, deriveOrderable, lineBlocker } from "./orderability.js";

describe("orderability (D-013)", () => {
  it.each([
    // doc fields                                   flags                       orderable  blocker
    [{}, { isActive: true, isAvailable: true, minOrderExempt: false }, true, null],
    [{ isActive: false }, { isActive: false, isAvailable: true, minOrderExempt: false }, false, "INACTIVE"],
    [{ isAvailable: false }, { isActive: true, isAvailable: false, minOrderExempt: false }, false, "UNAVAILABLE"],
    [{ isActive: false, isAvailable: false }, { isActive: false, isAvailable: false, minOrderExempt: false }, false, "INACTIVE"],
    [{ isActive: true, isAvailable: true, minOrderExempt: true }, { isActive: true, isAvailable: true, minOrderExempt: true }, true, null],
    [{ isActive: "false", minOrderExempt: "yes" }, { isActive: true, isAvailable: true, minOrderExempt: false }, true, null],
  ])("doc %j", (doc, flags, orderable, blocker) => {
    const f = normalizeProductFlags(doc as any);
    expect(f).toEqual(flags);
    expect(deriveOrderable(f)).toBe(orderable);
    expect(lineBlocker(f)).toBe(blocker);
  });

  it("does not consult stock", () => {
    const f = normalizeProductFlags({ stock: 0 } as any);
    expect(deriveOrderable(f)).toBe(true);
  });
});
