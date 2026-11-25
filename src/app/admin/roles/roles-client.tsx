"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Permission = {
  id: string;
  code: string;
  description: string | null;
};

type AdminRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionIds: string[];
  permissionCodes: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function RolesClient({
  roles,
  permissions,
  actorRoleId,
}: {
  roles: AdminRole[];
  permissions: Permission[];
  actorRoleId: string | null;
}) {
  const router = useRouter();
  const initialRole =
    roles.find((role) => role.code !== "OWNER") ?? roles[0] ?? null;
  const [selectedRoleId, setSelectedRoleId] = useState(initialRole?.id ?? "");
  const [permissionIds, setPermissionIds] = useState<string[]>(
    initialRole?.permissionIds ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const protectedRole =
    selectedRole?.code === "OWNER" || selectedRole?.id === actorRoleId;

  function selectRole(role: AdminRole) {
    setSelectedRoleId(role.id);
    setPermissionIds(role.permissionIds);
    setError(null);
    setNotice(null);
  }

  function togglePermission(permissionId: string) {
    setPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId],
    );
    setError(null);
    setNotice(null);
  }

  async function savePermissions() {
    if (!selectedRole || protectedRole) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/admin/roles/${encodeURIComponent(selectedRole.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissionIds }),
        },
      );
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : `Permissions save nahi hui (${response.status})`;
        setError(message);
        return;
      }

      setNotice(`${selectedRole.name} ki permissions update ho gayi.`);
      router.refresh();
    } catch (requestError) {
      console.error("Role permissions request failed:", requestError);
      setError("Server se rabta nahi ho saka. Dobara try karein.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
      <section className="h-fit rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-white">Existing roles</h2>
          <p className="mt-1 text-sm text-slate-400">
            Role select karke uske access permissions edit karein.
          </p>
        </div>
        <div className="space-y-2">
          {roles.map((role) => {
            const active = role.id === selectedRoleId;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role)}
                aria-pressed={active}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-orange-500/60 bg-orange-500/10"
                    : "border-[#293650] hover:bg-white/5"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{role.name}</span>
                  {role.code === "OWNER" && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                      Protected
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  {role.userCount} users · {role.permissionIds.length} permissions
                </span>
                {role.description && (
                  <span className="mt-2 block text-xs text-slate-500">
                    {role.description}
                  </span>
                )}
              </button>
            );
          })}
          {roles.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              Koi role configured nahi hai.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Permission access</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {selectedRole?.name ?? "Role select karein"}
            </h2>
            {selectedRole && (
              <p className="mt-1 text-xs text-slate-500">
                Role code: {selectedRole.code}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void savePermissions()}
            disabled={!selectedRole || protectedRole || busy}
            className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save permissions"}
          </button>
        </div>

        {protectedRole && selectedRole && (
          <p className="mb-4 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-300">
            {selectedRole.code === "OWNER"
              ? "Owner role protected hai taake system ka aakhri administrator lock out na ho."
              : "Apne current role ko edit karne se aapka access khatam ho sakta hai. Kisi doosre authorized admin se kahen."}
          </p>
        )}

        <div className="grid gap-2 md:grid-cols-2">
          {permissions.map((permission) => {
            const checked = permissionIds.includes(permission.id);
            return (
              <label
                key={permission.id}
                className={`flex gap-3 rounded-xl border p-3 ${
                  protectedRole
                    ? "cursor-not-allowed border-[#293650]/70 opacity-65"
                    : "cursor-pointer border-[#293650] hover:bg-white/[0.03]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={protectedRole || !selectedRole}
                  onChange={() => togglePermission(permission.id)}
                  className="mt-0.5 accent-orange-500"
                />
                <span className="min-w-0">
                  <span className="block break-all text-sm font-medium text-slate-200">
                    {permission.code}
                  </span>
                  {permission.description && (
                    <span className="mt-1 block text-xs text-slate-400">
                      {permission.description}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
          {permissions.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-slate-500">
              Database mein permissions nahi milin. Pehle seed setup verify karein.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {notice}
          </p>
        )}
      </section>
    </div>
  );
}
