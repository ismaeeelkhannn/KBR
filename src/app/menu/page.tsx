import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getPublicMenu } from "@/modules/public/menu.service";
import { PublicMenuClient } from "./menu-client";

export const metadata: Metadata = {
  title: "Menu | Khan Burger Jallo",
  description: "Khan Burger Jallo ka current menu aur verified prices.",
};

async function MenuContent() {
  await connection();
  const menu = await getPublicMenu();
  return <PublicMenuClient categories={menu} />;
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#fffaf3] text-sm text-slate-500">
          Menu load ho raha hai...
        </main>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
