"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, UtensilsCrossed } from "lucide-react";

type MenuVariant = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  pricePaisa: number | null;
  priceVerified: boolean;
};

type MenuProduct = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  variants: MenuVariant[];
};

type MenuCategory = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  products: MenuProduct[];
};

type VariantEditor = {
  productId: string;
  variantId: string | null;
  name: string;
  code: string;
  price: string;
  isActive: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function sendJson(
  url: string,
  method: "POST" | "PATCH",
  payload: unknown,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true };
    return {
      ok: false,
      error:
        isRecord(result) && typeof result.error === "string"
          ? result.error
          : `Save nahi hua (${response.status})`,
    };
  } catch (error) {
    console.error("Menu request failed:", error);
    return { ok: false, error: "Server se rabta nahi ho saka. Dobara try karein." };
  }
}

function money(paisa: number | null) {
  if (paisa === null) return "Price set nahi";
  return `Rs. ${(paisa / 100).toLocaleString("en-PK", {
    minimumFractionDigits: paisa % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function suggestedCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function MenuClient({ categories }: { categories: MenuCategory[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productPanelOpen, setProductPanelOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MenuProduct | null>(null);
  const [productName, setProductName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [categoryId, setCategoryId] = useState(
    categories.find((category) => category.isActive)?.id ?? "",
  );
  const [description, setDescription] = useState("");
  const [productActive, setProductActive] = useState(true);
  const [variantName, setVariantName] = useState("Regular");
  const [variantCode, setVariantCode] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [productBusy, setProductBusy] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [productNotice, setProductNotice] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryCodeEdited, setCategoryCodeEdited] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState<{
    id: string;
    name: string;
    sortOrder: string;
  } | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);
  const [variantEditor, setVariantEditor] = useState<VariantEditor | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [variantNotice, setVariantNotice] = useState<string | null>(null);
  const [categoryBusyId, setCategoryBusyId] = useState<string | null>(null);
  const [productBusyId, setProductBusyId] = useState<string | null>(null);

  const products = useMemo(
    () =>
      categories.flatMap((category) =>
        category.products.map((product) => ({
          ...product,
          categoryName: category.name,
        })),
      ),
    [categories],
  );

  const visibleProducts = products.filter((product) => {
    if (categoryFilter !== "all" && product.categoryId !== categoryFilter) {
      return false;
    }
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return [
      product.name,
      product.code,
      product.categoryName,
      ...product.variants.flatMap((variant) => [
        variant.name,
        variant.code,
      ]),
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
  const hasDemoCatalog = categories.some(
    (category) =>
      category.code.startsWith("DEMO-") ||
      category.products.some(
        (product) =>
          product.code.startsWith("DEMO-") ||
          product.variants.some((variant) => variant.code.startsWith("DEMO-")),
      ),
  );

  function resetProductForm() {
    setProductPanelOpen(false);
    setEditingProduct(null);
    setProductName("");
    setProductCode("");
    setCategoryId(categories.find((category) => category.isActive)?.id ?? "");
    setDescription("");
    setProductActive(true);
    setVariantName("Regular");
    setVariantCode("");
    setVariantPrice("");
    setProductError(null);
    setProductNotice(null);
  }

  function beginCreateProduct() {
    resetProductForm();
    setProductPanelOpen(true);
  }

  function beginEditProduct(product: MenuProduct) {
    setEditingProduct(product);
    setProductPanelOpen(true);
    setProductName(product.name);
    setProductCode(product.code);
    setCategoryId(product.categoryId);
    setDescription(product.description ?? "");
    setProductActive(product.isActive);
    setProductError(null);
    setProductNotice(null);
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductBusy(true);
    setProductError(null);
    setProductNotice(null);
    const endpoint = editingProduct
      ? `/api/admin/menu/products/${encodeURIComponent(editingProduct.id)}`
      : "/api/admin/menu/products";
    const method = editingProduct ? "PATCH" : "POST";
    const payload = editingProduct
      ? {
          ...(productName !== editingProduct.name ? { name: productName } : {}),
          ...(categoryId !== editingProduct.categoryId ? { categoryId } : {}),
          description: description.trim() || null,
          isActive: productActive,
        }
      : {
          categoryId,
          code: productCode,
          name: productName,
          description: description.trim() || null,
          variants: [
            {
              name: variantName,
              code: variantCode,
              pricePaisa: Math.round(Number(variantPrice) * 100),
            },
          ],
        };

    if (editingProduct && Object.keys(payload).length === 0) {
      setProductNotice("Koi change nahi hua.");
      setProductBusy(false);
      return;
    }

    const result = await sendJson(endpoint, method, payload);
    if (!result.ok) {
      setProductError(result.error ?? "Product save nahi hua");
    } else {
      const notice = editingProduct
        ? "Product update ho gaya."
        : "Product create ho gaya.";
      resetProductForm();
      setProductNotice(notice);
      router.refresh();
    }
    setProductBusy(false);
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryBusy(true);
    setCategoryError(null);
    setCategoryNotice(null);
    const result = await sendJson("/api/admin/menu/categories", "POST", {
      code: categoryCode,
      name: categoryName,
    });
    if (!result.ok) {
      setCategoryError(result.error ?? "Category save nahi hui");
    } else {
      setCategoryName("");
      setCategoryCode("");
      setCategoryCodeEdited(false);
      setCategoryNotice("Category add ho gayi.");
      router.refresh();
    }
    setCategoryBusy(false);
  }

  async function toggleCategory(category: MenuCategory) {
    setCategoryBusyId(category.id);
    setCategoryError(null);
    const result = await sendJson(
      `/api/admin/menu/categories/${encodeURIComponent(category.id)}`,
      "PATCH",
      { isActive: !category.isActive },
    );
    if (!result.ok) {
      setCategoryError(result.error ?? "Category update nahi hui");
    } else {
      setCategoryNotice(
        category.isActive ? "Category hide kar di." : "Category wapas active hai.",
      );
      router.refresh();
    }
    setCategoryBusyId(null);
  }

  async function saveCategoryEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryEditor) return;
    setCategoryBusyId(categoryEditor.id);
    setCategoryError(null);
    setCategoryNotice(null);
    const result = await sendJson(
      `/api/admin/menu/categories/${encodeURIComponent(categoryEditor.id)}`,
      "PATCH",
      {
        name: categoryEditor.name,
        sortOrder: Number(categoryEditor.sortOrder),
      },
    );
    if (!result.ok) {
      setCategoryError(result.error ?? "Category update nahi hui");
    } else {
      setCategoryEditor(null);
      setCategoryNotice("Category update ho gayi.");
      router.refresh();
    }
    setCategoryBusyId(null);
  }

  function beginEditVariant(product: MenuProduct, variant: MenuVariant) {
    setVariantEditor({
      productId: product.id,
      variantId: variant.id,
      name: variant.name,
      code: variant.code,
      price:
        variant.pricePaisa === null
          ? ""
          : (variant.pricePaisa / 100).toFixed(2),
      isActive: variant.isActive,
    });
    setVariantError(null);
    setVariantNotice(null);
  }

  function beginAddVariant(product: MenuProduct) {
    setVariantEditor({
      productId: product.id,
      variantId: null,
      name: "",
      code: "",
      price: "",
      isActive: true,
    });
    setVariantError(null);
    setVariantNotice(null);
  }

  async function submitVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!variantEditor) return;
    setVariantBusy(true);
    setVariantError(null);
    setVariantNotice(null);
    const endpoint = variantEditor.variantId
      ? `/api/admin/menu/variants/${encodeURIComponent(variantEditor.variantId)}`
      : `/api/admin/menu/products/${encodeURIComponent(variantEditor.productId)}/variants`;
    const method = variantEditor.variantId ? "PATCH" : "POST";
    const payload = variantEditor.variantId
      ? {
          name: variantEditor.name,
          pricePaisa: Math.round(Number(variantEditor.price) * 100),
          isActive: variantEditor.isActive,
        }
      : {
          name: variantEditor.name,
          code: variantEditor.code,
          pricePaisa: Math.round(Number(variantEditor.price) * 100),
        };

    const result = await sendJson(endpoint, method, payload);
    if (!result.ok) {
      setVariantError(result.error ?? "Variant save nahi hua");
    } else {
      setVariantNotice(
        variantEditor.variantId ? "Item update ho gaya." : "Size add ho gaya.",
      );
      setVariantEditor(null);
      router.refresh();
    }
    setVariantBusy(false);
  }

  async function toggleProduct(product: MenuProduct) {
    setProductBusyId(product.id);
    const result = await sendJson(
      `/api/admin/menu/products/${encodeURIComponent(product.id)}`,
      "PATCH",
      { isActive: !product.isActive },
    );
    if (!result.ok) {
      setProductNotice(result.error ?? "Product update nahi hua");
    } else {
      setProductNotice(product.isActive ? "Product hide kar diya." : "Product active hai.");
      router.refresh();
    }
    setProductBusyId(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#26334e] bg-gradient-to-br from-[#151f35] via-[#111a2e] to-[#1b2435] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
              Catalog studio
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Apna menu, apne control mein.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Categories, item availability aur prices yahan update karein.
              Har price change history mein naya version banata hai; purane
              orders ke rates nahi badalte.
            </p>
          </div>
          <button
            type="button"
            onClick={beginCreateProduct}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-950/30 transition hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Naya menu item
          </button>
        </div>
        <div className="mt-7 flex flex-wrap gap-3 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            {categories.length} categories
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            {products.length} items
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            {products.reduce((count, product) => count + product.variants.length, 0)} sizes / codes
          </span>
        </div>
      </section>

      {hasDemoCatalog && (
        <div
          role="status"
          className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          DEMO catalog rows sirf setup examples hain. Public menu mein nahi
          dikhte; apne verified menu items yahan add karein.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.65fr)]">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Naam ya item code se search karein"
                className="w-full rounded-xl border border-[#293650] bg-[#0f1629] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-500"
              />
            </label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-[#293650] bg-[#0f1629] px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            >
              <option value="all">Tamam categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {productNotice && !productPanelOpen && (
            <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {productNotice}
            </p>
          )}
          {variantNotice && !variantEditor && (
            <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {variantNotice}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5 transition hover:border-[#394966]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-orange-300">
                      {product.categoryName}
                    </p>
                    <h3 className="mt-1 truncate text-lg font-semibold text-white">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Product code: {product.code}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      product.isActive
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-slate-500/15 text-slate-400"
                    }`}
                  >
                    {product.isActive ? "Live" : "Hidden"}
                  </span>
                </div>
                {product.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-400">
                    {product.description}
                  </p>
                )}

                <div className="mt-4 divide-y divide-[#26334e]">
                  {product.variants.map((variant) => (
                    <div key={variant.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-200">
                            {variant.name}
                            {!variant.isActive && (
                              <span className="ml-2 text-[10px] uppercase text-slate-500">
                                hidden
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Code {variant.code}
                            {!variant.priceVerified && " · needs price review"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">
                            {money(variant.pricePaisa)}
                          </p>
                          <button
                            type="button"
                            onClick={() => beginEditVariant(product, variant)}
                            className="mt-1 text-xs font-medium text-orange-300 hover:text-orange-200"
                          >
                            Price / status edit
                          </button>
                        </div>
                      </div>
                      {variantEditor?.variantId === variant.id && (
                        <form
                          onSubmit={submitVariant}
                          className="mt-3 grid gap-3 rounded-xl border border-[#293650] bg-[#151d33] p-3 sm:grid-cols-2"
                        >
                          <label className="space-y-1 text-xs text-slate-400">
                            Item name
                            <input
                              required
                              value={variantEditor.name}
                              onChange={(event) =>
                                setVariantEditor({
                                  ...variantEditor,
                                  name: event.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-[#34415b] bg-[#0f1629] px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                            />
                          </label>
                          <label className="space-y-1 text-xs text-slate-400">
                            Price (Rs.)
                            <input
                              required
                              min="0.01"
                              step="0.01"
                              type="number"
                              value={variantEditor.price}
                              onChange={(event) =>
                                setVariantEditor({
                                  ...variantEditor,
                                  price: event.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-[#34415b] bg-[#0f1629] px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={variantEditor.isActive}
                              onChange={(event) =>
                                setVariantEditor({
                                  ...variantEditor,
                                  isActive: event.target.checked,
                                })
                              }
                              className="accent-orange-500"
                            />
                            Available for sale
                          </label>
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setVariantEditor(null)}
                              className="text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={variantBusy}
                              className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {variantBusy ? "Saving..." : "Save"}
                            </button>
                          </div>
                          {variantError && (
                            <p role="alert" className="text-xs text-red-300 sm:col-span-2">
                              {variantError}
                            </p>
                          )}
                        </form>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#26334e] pt-4">
                  <button
                    type="button"
                    onClick={() => beginAddVariant(product)}
                    className="text-xs font-medium text-slate-300 hover:text-white"
                  >
                    + Add size / item code
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => beginEditProduct(product)}
                      className="text-xs font-medium text-orange-300 hover:text-orange-200"
                    >
                      Edit details
                    </button>
                    <button
                      type="button"
                      disabled={productBusyId === product.id}
                      onClick={() => void toggleProduct(product)}
                      className="text-xs text-slate-400 hover:text-white disabled:opacity-50"
                    >
                      {productBusyId === product.id
                        ? "Saving..."
                        : product.isActive
                          ? "Hide item"
                          : "Restore"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {visibleProducts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#293650] bg-[#0f1629]/60 px-6 py-12 text-center">
              <UtensilsCrossed className="mx-auto h-8 w-8 text-slate-500" />
              <h3 className="mt-3 font-semibold text-white">Koi item nahi mila</h3>
              <p className="mt-1 text-sm text-slate-400">
                Search badlein ya naya menu item add karein.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
            <h2 className="font-semibold text-white">Categories</h2>
            <p className="mt-1 text-sm text-slate-400">
              Category hide karne se uske items POS aur public menu se chup jayenge.
            </p>
            <div className="mt-4 space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-xl border border-[#293650] px-3 py-2.5"
                >
                  {categoryEditor?.id === category.id ? (
                    <form onSubmit={saveCategoryEdit} className="space-y-2">
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        value={categoryEditor.name}
                        onChange={(event) =>
                          setCategoryEditor({
                            ...categoryEditor,
                            name: event.target.value,
                          })
                        }
                        aria-label="Category name"
                        className="w-full rounded-lg border border-[#34415b] bg-[#151d33] px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                      />
                      <input
                        required
                        min="0"
                        max="10000"
                        type="number"
                        value={categoryEditor.sortOrder}
                        onChange={(event) =>
                          setCategoryEditor({
                            ...categoryEditor,
                            sortOrder: event.target.value,
                          })
                        }
                        aria-label="Category order"
                        className="w-full rounded-lg border border-[#34415b] bg-[#151d33] px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                      />
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setCategoryEditor(null)}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={categoryBusyId === category.id}
                          className="text-xs font-medium text-orange-300 disabled:opacity-50"
                        >
                          {categoryBusyId === category.id ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-200">
                          {category.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {category.code} · {category.products.length} items
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setCategoryEditor({
                              id: category.id,
                              name: category.name,
                              sortOrder: String(category.sortOrder),
                            })
                          }
                          className="text-xs text-slate-300 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={categoryBusyId === category.id}
                          onClick={() => void toggleCategory(category)}
                          className="text-xs text-orange-300 hover:text-orange-200 disabled:opacity-50"
                        >
                          {categoryBusyId === category.id
                            ? "..."
                            : category.isActive
                              ? "Hide"
                              : "Restore"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {categoryError && (
              <p role="alert" className="mt-3 text-sm text-red-300">
                {categoryError}
              </p>
            )}
            {categoryNotice && (
              <p role="status" className="mt-3 text-sm text-emerald-300">
                {categoryNotice}
              </p>
            )}
          </section>

          {productPanelOpen && (
            <section className="rounded-2xl border border-orange-500/30 bg-[#0f1629] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">
                    {editingProduct ? "Edit item" : "Add menu item"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Prices rupees mein enter karein.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetProductForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <form onSubmit={submitProduct} className="space-y-3">
                <label className="block space-y-1 text-xs text-slate-400">
                  Category
                  <select
                    required
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                  >
                    {categories
                      .filter(
                        (category) =>
                          category.isActive ||
                          category.id === editingProduct?.categoryId,
                      )
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                          {!category.isActive ? " (hidden)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block space-y-1 text-xs text-slate-400">
                  Item name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                  />
                </label>
                {editingProduct ? (
                  <div className="rounded-lg bg-[#151d33] p-3 text-xs text-slate-400">
                    Item code <span className="font-mono text-slate-200">{productCode}</span>
                    <br />
                    Codes fixed rehte hain taake existing POS item-code workflow na toote.
                  </div>
                ) : (
                  <>
                    <label className="block space-y-1 text-xs text-slate-400">
                      Product code
                      <input
                        required
                        maxLength={60}
                        value={productCode}
                        onChange={(event) => setProductCode(event.target.value)}
                        className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-orange-500"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1 text-xs text-slate-400">
                        First size
                        <input
                          required
                          maxLength={120}
                          value={variantName}
                          onChange={(event) => setVariantName(event.target.value)}
                          className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                        />
                      </label>
                      <label className="block space-y-1 text-xs text-slate-400">
                        Item code
                        <input
                          required
                          maxLength={60}
                          value={variantCode}
                          onChange={(event) => setVariantCode(event.target.value)}
                          className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-orange-500"
                        />
                      </label>
                    </div>
                    <label className="block space-y-1 text-xs text-slate-400">
                      Price (Rs.)
                      <input
                        required
                        min="0.01"
                        step="0.01"
                        type="number"
                        value={variantPrice}
                        onChange={(event) => setVariantPrice(event.target.value)}
                        className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                      />
                    </label>
                  </>
                )}
                <label className="block space-y-1 text-xs text-slate-400">
                  Description (optional)
                  <textarea
                    maxLength={500}
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full resize-y rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                  />
                </label>
                {editingProduct && (
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={productActive}
                      onChange={(event) => setProductActive(event.target.checked)}
                      className="accent-orange-500"
                    />
                    Available on menu
                  </label>
                )}
                {productError && (
                  <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                    {productError}
                  </p>
                )}
                {productNotice && (
                  <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    {productNotice}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={
                    productBusy ||
                    (!editingProduct &&
                      (!categoryId || !variantCode || !variantPrice))
                  }
                  className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {productBusy
                    ? "Saving..."
                    : editingProduct
                      ? "Save item details"
                      : "Add item"}
                </button>
              </form>
            </section>
          )}

          {variantEditor && (
            <section className="rounded-2xl border border-orange-500/30 bg-[#0f1629] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-white">
                  {variantEditor.variantId ? "Edit size / price" : "Add size / item code"}
                </h2>
                <button
                  type="button"
                  onClick={() => setVariantEditor(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <form onSubmit={submitVariant} className="space-y-3">
                <label className="block space-y-1 text-xs text-slate-400">
                  Size / item name
                  <input
                    required
                    maxLength={120}
                    value={variantEditor.name}
                    onChange={(event) =>
                      setVariantEditor({ ...variantEditor, name: event.target.value })
                    }
                    className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                  />
                </label>
                {!variantEditor.variantId && (
                  <label className="block space-y-1 text-xs text-slate-400">
                    Item code
                    <input
                      required
                      maxLength={60}
                      value={variantEditor.code}
                      onChange={(event) =>
                        setVariantEditor({ ...variantEditor, code: event.target.value })
                      }
                      className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-orange-500"
                    />
                  </label>
                )}
                <label className="block space-y-1 text-xs text-slate-400">
                  Price (Rs.)
                  <input
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={variantEditor.price}
                    onChange={(event) =>
                      setVariantEditor({ ...variantEditor, price: event.target.value })
                    }
                    className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                  />
                </label>
                {variantEditor.variantId && (
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={variantEditor.isActive}
                      onChange={(event) =>
                        setVariantEditor({
                          ...variantEditor,
                          isActive: event.target.checked,
                        })
                      }
                      className="accent-orange-500"
                    />
                    Available for sale
                  </label>
                )}
                {variantError && (
                  <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                    {variantError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={variantBusy}
                  className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {variantBusy ? "Saving..." : "Save size"}
                </button>
              </form>
            </section>
          )}

          <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
            <h2 className="font-semibold text-white">Add a category</h2>
            <form onSubmit={submitCategory} className="mt-3 space-y-3">
              <label className="block space-y-1 text-xs text-slate-400">
                Category name
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={categoryName}
                  onChange={(event) => {
                    setCategoryName(event.target.value);
                    if (!categoryCodeEdited) {
                      setCategoryCode(suggestedCode(event.target.value));
                    }
                  }}
                  className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-400">
                Category code
                <input
                  required
                  maxLength={60}
                  value={categoryCode}
                  onChange={(event) => {
                    setCategoryCodeEdited(true);
                    setCategoryCode(event.target.value);
                  }}
                  className="w-full rounded-lg border border-[#293650] bg-[#151d33] px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-orange-500"
                />
              </label>
              {categoryError && (
                <p role="alert" className="text-sm text-red-300">
                  {categoryError}
                </p>
              )}
              {categoryNotice && (
                <p role="status" className="text-sm text-emerald-300">
                  {categoryNotice}
                </p>
              )}
              <button
                type="submit"
                disabled={categoryBusy}
                className="w-full rounded-xl border border-[#35435f] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
              >
                {categoryBusy ? "Saving..." : "Create category"}
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
