import assert from "node:assert/strict";
import test from "node:test";
import {
  menuCategoryCreateSchema,
  menuProductCreateSchema,
} from "./admin-menu.schemas";

test("menu category codes are normalized", () => {
  const parsed = menuCategoryCreateSchema.parse({
    code: "  hot-drinks ",
    name: "Hot Drinks",
  });

  assert.equal(parsed.code, "HOT-DRINKS");
});

test("menu product rejects duplicate case-insensitive item codes", () => {
  const parsed = menuProductCreateSchema.safeParse({
    categoryId: "category-a",
    code: "product-code",
    name: "Chicken Burger",
    variants: [
      { code: "chicken-reg", name: "Regular", pricePaisa: 50000 },
      { code: "CHICKEN-REG", name: "Large", pricePaisa: 70000 },
    ],
  });

  assert.equal(parsed.success, false);
});

test("menu product prices must be positive integer paisa", () => {
  const parsed = menuProductCreateSchema.safeParse({
    categoryId: "category-a",
    code: "chicken",
    name: "Chicken Burger",
    variants: [{ code: "chicken-reg", name: "Regular", pricePaisa: 500.5 }],
  });

  assert.equal(parsed.success, false);
});
