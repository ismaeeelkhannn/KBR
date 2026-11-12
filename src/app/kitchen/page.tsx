import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { KitchenBoard } from "./kitchen-board";

async function KitchenPageContent() {
  await connection();

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="mb-4 text-2xl font-bold">Kitchen Display</h1>
      <KitchenBoard />
    </main>
  );
}

export default function KitchenPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6">
          <p>Kitchen load ho raha hai...</p>
        </main>
      }
    >
      <KitchenPageContent />
    </Suspense>
  );
}
