import assert from "node:assert/strict";
import test from "node:test";
import { cancelRequestSchema } from "./approval.schemas";

test("cancellation reasons must use a supported option", () => {
  assert.equal(
    cancelRequestSchema.safeParse({ reasonCode: "WRONG_ORDER" }).success,
    true
  );
  assert.equal(
    cancelRequestSchema.safeParse({ reasonCode: "Made up reason" }).success,
    false
  );
});

test("Other cancellation reasons require custom text", () => {
  assert.equal(
    cancelRequestSchema.safeParse({ reasonCode: "OTHER" }).success,
    false
  );
  assert.equal(
    cancelRequestSchema.safeParse({
      reasonCode: "OTHER",
      customReason: "Customer requested cancellation",
    }).success,
    true
  );
  assert.equal(
    cancelRequestSchema.safeParse({
      reasonCode: "WRONG_ORDER",
      customReason: "Not allowed here",
    }).success,
    false
  );
});
