import assert from "node:assert/strict";
import test from "node:test";
import {
  adminUserCreateSchema,
  adminUserUpdateSchema,
} from "./admin-users.schemas";

test("admin user create normalizes usernames", () => {
  const parsed = adminUserCreateSchema.parse({
    username: "Cashier.One",
    fullName: "Cashier One",
    password: "a-secure-password",
    roleId: "role-cashier",
    branchIds: ["branch-a"],
  });

  assert.equal(parsed.username, "cashier.one");
});

test("admin user create rejects duplicate branch assignments", () => {
  const parsed = adminUserCreateSchema.safeParse({
    username: "cashier.one",
    fullName: "Cashier One",
    password: "a-secure-password",
    roleId: "role-cashier",
    branchIds: ["branch-a", "branch-a"],
  });

  assert.equal(parsed.success, false);
});

test("admin user create requires a sufficiently long password", () => {
  const parsed = adminUserCreateSchema.safeParse({
    username: "cashier.one",
    fullName: "Cashier One",
    password: "short",
    roleId: "role-cashier",
    branchIds: ["branch-a"],
  });

  assert.equal(parsed.success, false);
});

test("admin user update rejects an empty patch", () => {
  assert.equal(adminUserUpdateSchema.safeParse({}).success, false);
});
