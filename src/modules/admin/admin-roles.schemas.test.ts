import assert from "node:assert/strict";
import test from "node:test";
import { rolePermissionsUpdateSchema } from "./admin-roles.schemas";

test("role permission update accepts a unique permission set", () => {
  const parsed = rolePermissionsUpdateSchema.safeParse({
    permissionIds: ["permission-pos", "permission-orders"],
  });

  assert.equal(parsed.success, true);
});

test("role permission update rejects duplicate permission IDs", () => {
  const parsed = rolePermissionsUpdateSchema.safeParse({
    permissionIds: ["permission-pos", "permission-pos"],
  });

  assert.equal(parsed.success, false);
});

test("role permission update permits removing every permission", () => {
  const parsed = rolePermissionsUpdateSchema.safeParse({ permissionIds: [] });

  assert.equal(parsed.success, true);
});
