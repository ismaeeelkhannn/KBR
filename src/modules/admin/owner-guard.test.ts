import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAssignRole, canModifyExistingUser } from "./owner-guard";

describe("canAssignRole", () => {
  it("allows an OWNER actor to assign OWNER", () => {
    assert.equal(canAssignRole("OWNER", "OWNER").allowed, true);
  });

  it("blocks non-owner actors from assigning OWNER", () => {
    for (const actor of ["ADMIN", "MANAGER", "CASHIER", "ACCOUNTANT", null]) {
      assert.equal(canAssignRole(actor, "OWNER").allowed, false, `actor ${actor}`);
    }
  });

  it("allows non-owner roles to be assigned by anyone with the permission", () => {
    assert.equal(canAssignRole("MANAGER", "CASHIER").allowed, true);
    assert.equal(canAssignRole("MANAGER", "KITCHEN").allowed, true);
  });
});

describe("canModifyExistingUser", () => {
  it("blocks non-owner actors from editing an OWNER account", () => {
    assert.equal(canModifyExistingUser("MANAGER", "OWNER").allowed, false);
    assert.equal(canModifyExistingUser(undefined, "OWNER").allowed, false);
  });

  it("allows an OWNER actor to edit an OWNER account", () => {
    assert.equal(canModifyExistingUser("OWNER", "OWNER").allowed, true);
  });

  it("allows edits to non-owner accounts", () => {
    assert.equal(canModifyExistingUser("MANAGER", "CASHIER").allowed, true);
  });
});
