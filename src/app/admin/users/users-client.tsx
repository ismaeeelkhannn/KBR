"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Branch = { id: string; name: string };
type Role = { id: string; code: string; name: string };
type AdminUser = {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
  role: Role;
  branchAccess: Branch[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function UsersClient({
  users,
  roles,
  branches,
  canManageRoles,
}: {
  users: AdminUser[];
  roles: Role[];
  branches: Branch[];
  canManageRoles: boolean;
}) {
  const router = useRouter();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [branchIds, setBranchIds] = useState<string[]>(
    branches[0] ? [branches[0].id] : [],
  );
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function resetForm() {
    setEditingUser(null);
    setFullName("");
    setUsername("");
    setPassword("");
    setRoleId(roles[0]?.id ?? "");
    setBranchIds(branches[0] ? [branches[0].id] : []);
    setIsActive(true);
    setError(null);
    setNotice(null);
  }

  function editUser(user: AdminUser) {
    setEditingUser(user);
    setFullName(user.fullName);
    setUsername(user.username);
    setPassword("");
    setRoleId(user.role.id);
    setBranchIds(user.branchAccess.map((branch) => branch.id));
    setIsActive(user.isActive);
    setError(null);
    setNotice(null);
  }

  function toggleBranch(branchId: string) {
    setBranchIds((current) =>
      current.includes(branchId)
        ? current.filter((id) => id !== branchId)
        : [...current, branchId],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (branchIds.length === 0) {
      setError("Kam az kam ek active branch select karein.");
      return;
    }
    if (!editingUser && password.length < 12) {
      setError("Naye user ka password kam az kam 12 characters ka hona chahiye.");
      return;
    }
    setBusy(true);

    try {
      const response = await fetch(
        editingUser
          ? `/api/admin/users/${encodeURIComponent(editingUser.id)}`
          : "/api/admin/users",
        {
          method: editingUser ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            fullName,
            roleId,
            branchIds,
            ...(password ? { password } : {}),
            ...(editingUser ? { isActive } : {}),
          }),
        },
      );
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : `User save nahi hua (${response.status})`;
        setError(message);
        return;
      }

      const savedNotice = editingUser
        ? "User update ho gaya."
        : "User create ho gaya.";
      resetForm();
      setNotice(savedNotice);
      router.refresh();
    } catch (requestError) {
      console.error("Admin user request failed:", requestError);
      setError("Server se rabta nahi ho saka. Dobara try karein.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
      <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
        <div className="mb-5">
          <h2 className="font-semibold text-white">System users</h2>
          <p className="mt-1 text-sm text-slate-400">
            Role aur branch access review karein. Password hashes kabhi display nahi hote.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#1b2540] text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Branches</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[#1b2540]/70 last:border-0"
                >
                  <td className="py-4">
                    <p className="font-medium text-white">{user.fullName}</p>
                    <p className="text-xs text-slate-500">{user.username}</p>
                  </td>
                  <td className="py-4 text-slate-300">{user.role.name}</td>
                  <td className="py-4 text-slate-400">
                    {user.branchAccess.map((branch) => branch.name).join(", ") ||
                      "No branch"}
                  </td>
                  <td className="py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        user.isActive
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-500/15 text-slate-400"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button
                      type="button"
                      onClick={() => editUser(user)}
                      className="rounded-lg border border-[#293650] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Koi user nahi mila.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="h-fit rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">
              {editingUser ? "Edit user" : "Create user"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Account changes audit log mein record honge.
            </p>
          </div>
          {editingUser && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>

        {!canManageRoles ? (
          <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-300">
            User list available hai. User create ya role assign karne ke liye
            roles.manage permission chahiye.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Full name</span>
              <input
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-xl border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Username</span>
              <input
                required
                minLength={3}
                maxLength={64}
                pattern="(?:[A-Za-z0-9._]|-)+"
                autoComplete="off"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">
                {editingUser ? "Reset password (optional)" : "Temporary password"}
              </span>
              <input
                required={!editingUser}
                minLength={12}
                maxLength={256}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={editingUser ? "Blank chhodein to password same rahega" : ""}
                className="w-full rounded-xl border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Role</span>
              <select
                required
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
                className="w-full rounded-xl border border-[#293650] bg-[#151d33] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-slate-300">
                Branch access
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {branches.map((branch) => (
                  <label
                    key={branch.id}
                    className="flex items-center gap-2 rounded-lg border border-[#293650] px-3 py-2 text-sm text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={branchIds.includes(branch.id)}
                      onChange={() => toggleBranch(branch.id)}
                      className="accent-orange-500"
                    />
                    {branch.name}
                  </label>
                ))}
              </div>
            </fieldset>

            {editingUser && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="accent-orange-500"
                />
                Account active
              </label>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || branches.length === 0 || roles.length === 0}
              className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Saving..."
                : editingUser
                  ? "Save changes"
                  : "Create account"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
