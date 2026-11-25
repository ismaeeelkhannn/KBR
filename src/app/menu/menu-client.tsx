"use client";

import { useState } from "react";
import { Search, UtensilsCrossed } from "lucide-react";

type PublicVariant = {
  id: string;
  name: string;
  pricePaisa: number;
};

type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  variants: PublicVariant[];
};

type PublicCategory = {
  id: string;
  name: string;
  products: PublicProduct[];
};

function price(paisa: number) {
  return `Rs. ${(paisa / 100).toLocaleString("en-PK", {
    minimumFractionDigits: paisa % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function PublicMenuClient({
  categories,
}: {
  categories: PublicCategory[];
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCategories = categories
    .filter(
      (category) =>
        activeCategory === "all" || category.id === activeCategory,
    )
    .map((category) => ({
      ...category,
      products: category.products.filter((product) => {
        if (!normalizedQuery) return true;
        return [product.name, product.description ?? "", ...product.variants.map((variant) => variant.name)]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
    }))
    .filter((category) => category.products.length > 0);

  const itemCount = categories.reduce(
    (total, category) => total + category.products.length,
    0,
  );

  return (
    <main className="min-h-screen bg-[#fffaf3] text-[#202331]">
      <header className="relative overflow-hidden bg-[#10192b] text-white">
        <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 pb-12 pt-6 sm:px-8 sm:pb-16">
          <nav className="flex items-center justify-between">
            <a href="/menu" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-500 text-xl font-black text-white shadow-lg shadow-orange-950/30">
                K
              </span>
              <span>
                <span className="block text-sm font-bold tracking-wide">
                  KHAN BURGER
                </span>
                <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Jallo
                </span>
              </span>
            </a>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
              Menu
            </span>
          </nav>

          <div className="mt-14 max-w-2xl sm:mt-20">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-300">
              Khan Burger & Restaurant
            </p>
            <h1 className="mt-4 text-5xl font-black leading-[0.98] tracking-tight sm:text-7xl">
              Aaj kya
              <br />
              <span className="text-orange-400">khayenge?</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
              Hamara menu dekhein aur apni pasand ka item dhoondein.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {itemCount} menu items listed
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-orange-600 via-amber-400 to-orange-500" />
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
        <div className="sticky top-0 z-10 -mx-5 border-b border-[#e8dfd3] bg-[#fffaf3]/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
          <label className="relative block max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Menu mein search karein"
              className="w-full rounded-2xl border border-[#e6ddcf] bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                activeCategory === "all"
                  ? "bg-[#10192b] text-white"
                  : "border border-[#e6ddcf] bg-white text-slate-600 hover:border-orange-300"
              }`}
            >
              Sab items
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  activeCategory === category.id
                    ? "bg-[#10192b] text-white"
                    : "border border-[#e6ddcf] bg-white text-slate-600 hover:border-orange-300"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {visibleCategories.length > 0 ? (
          <div className="mt-8 space-y-12">
            {visibleCategories.map((category) => (
              <section key={category.id} aria-labelledby={`category-${category.id}`}>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                      Khan Burger
                    </p>
                    <h2
                      id={`category-${category.id}`}
                      className="mt-1 text-2xl font-black tracking-tight text-[#10192b] sm:text-3xl"
                    >
                      {category.name}
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500">
                    {category.products.length} items
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {category.products.map((product) => (
                    <article
                      key={product.id}
                      className="group rounded-2xl border border-[#eee5d9] bg-white p-5 shadow-[0_8px_30px_rgba(40,30,15,0.04)] transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_14px_36px_rgba(40,30,15,0.09)]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600 transition group-hover:bg-orange-100">
                          <UtensilsCrossed className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold leading-5 text-[#172033]">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="mt-1.5 text-xs leading-5 text-slate-500">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-5 divide-y divide-[#f1ece5]">
                        {product.variants.map((variant) => (
                          <div
                            key={variant.id}
                            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                          >
                            <span className="text-sm text-slate-600">
                              {variant.name}
                            </span>
                            <span className="whitespace-nowrap rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-extrabold text-orange-700">
                              {price(variant.pricePaisa)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-dashed border-[#dfd4c5] bg-white/70 px-6 py-16 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-4 text-lg font-bold text-[#10192b]">
              {categories.length === 0
                ? "Menu setup ho raha hai"
                : "Is search ka item nahi mila"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {categories.length === 0
                ? "Menu items aur verified prices add hote hi yahan nazar aayenge."
                : "Naam ya category badal kar dobara search karein."}
            </p>
          </div>
        )}
      </section>

      <footer className="border-t border-[#e8dfd3] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-semibold tracking-wide text-[#10192b]">
            KHAN BURGER · JALLO
          </span>
          <span>Prices are shown in Pakistani Rupees.</span>
        </div>
      </footer>
    </main>
  );
}
