import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findItemByCode } from "./item-code";

describe("findItemByCode", () => {
  const items = [
    { code: "BURGER-REG", name: "Regular Burger" },
    { code: "DRINK-500", name: "500 ml Drink" },
  ];

  it("trims input and matches codes without case sensitivity", () => {
    assert.deepEqual(findItemByCode(items, " burger-reg "), {
      status: "found",
      item: items[0],
    });
  });

  it("requires a full exact code match", () => {
    assert.deepEqual(findItemByCode(items, "BURGER"), {
      status: "not_found",
    });
  });

  it("rejects normalized duplicate codes instead of selecting arbitrarily", () => {
    assert.deepEqual(
      findItemByCode(
        [{ code: "ITEM-1" }, { code: "item-1" }],
        "Item-1",
      ),
      { status: "ambiguous" },
    );
  });

  it("distinguishes blank input from an unknown code", () => {
    assert.deepEqual(findItemByCode(items, "   "), { status: "empty" });
    assert.deepEqual(findItemByCode(items, "MISSING"), {
      status: "not_found",
    });
  });
});
