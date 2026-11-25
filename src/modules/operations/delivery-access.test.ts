import assert from "node:assert/strict";
import test from "node:test";
import { isAssignedDeliveryRider } from "./delivery-access";

test("delivery actions require the exact assigned delivery user", () => {
  assert.equal(isAssignedDeliveryRider("DELIVERY", "rider-1", "rider-1"), true);
  assert.equal(isAssignedDeliveryRider("DELIVERY", "rider-1", "rider-2"), false);
  assert.equal(isAssignedDeliveryRider("MANAGER", "rider-1", "rider-1"), false);
  assert.equal(isAssignedDeliveryRider("DELIVERY", null, "rider-1"), false);
});
