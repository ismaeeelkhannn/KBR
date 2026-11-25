import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOnHandMovement, sumOnHand } from "./on-hand";

describe("on-hand stock", () => {
  it("excludes WASTAGE rows", () => {
    assert.equal(isOnHandMovement("WASTAGE"), false);
    assert.equal(isOnHandMovement("SALE_DEDUCTION"), true);
    assert.equal(isOnHandMovement("PURCHASE"), true);
  });

  it("does not double count a cancelled sale", () => {
    // 10 received, 3 used by an order, then the order is cancelled.
    // The cancel writes a WASTAGE row of the same -3 for loss reporting.
    const movements = [
      { type: "PURCHASE", quantityBase: 10 },
      { type: "SALE_DEDUCTION", quantityBase: -3 },
      { type: "WASTAGE", quantityBase: -3 },
    ];
    assert.equal(sumOnHand(movements), 7);
  });

  it("sums zero for no movements", () => {
    assert.equal(sumOnHand([]), 0);
  });
});
