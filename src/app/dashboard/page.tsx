import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { LogoutButton } from "./logout-button";

async function DashboardContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">Khan Burger Dashboard</h1>
      <p className="text-lg">
        Khush aamdeed, <strong>{user.fullName}</strong>
      </p>
      <p className="text-gray-600">
        Role: {user.role.name} ({user.role.code})
      </p>
      <p className="text-sm text-gray-500">
        Ye ek placeholder page hai. Asli dashboard Batch 8 ke baad banega.
      </p>
      <LogoutButton />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-8">
          <p>Dashboard load ho raha hai...</p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
