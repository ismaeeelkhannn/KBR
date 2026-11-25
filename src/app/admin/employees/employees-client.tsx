"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type Branch = { id: string; name: string };
type Department = { id: string; name: string; code: string };
type LoginUser = { id: string; fullName: string; username: string };
type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  jobTitle: string;
  joiningDate: string;
  monthlySalaryPaisa: number;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED";
  branch: Branch;
  department: Department | null;
  assignedManager: { id: string; fullName: string } | null;
  user: { id: string; username: string; isActive: boolean } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function EmployeesClient({
  employees,
  branches,
  departments,
  loginUsers,
  canCreate,
  canUpdate,
  canDeactivate,
}: {
  employees: Employee[];
  branches: Branch[];
  departments: Department[];
  loginUsers: LoginUser[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [cnic, setCnic] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [assignedManagerId, setAssignedManagerId] = useState("");
  const [linkedUserId, setLinkedUserId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id ?? "");
  const [joiningDate, setJoiningDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [salary, setSalary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visibleEmployees = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (branchId && employee.branch.id !== branchId) return false;
      if (status && employee.status !== status) return false;
      if (!needle) return true;
      return [employee.employeeCode, employee.fullName, employee.phone, employee.email]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [employees, search, branchId, status]);

  function reset() {
    setEditing(null);
    setFullName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setCnic("");
    setJobTitle("");
    setDepartmentId("");
    setAssignedManagerId("");
    setLinkedUserId("");
    setSelectedBranchId(branches[0]?.id ?? "");
    setJoiningDate(new Date().toISOString().slice(0, 10));
    setSalary("");
    setError(null);
  }

  function edit(employee: Employee) {
    setEditing(employee);
    setFullName(employee.fullName);
    setPhone(employee.phone ?? "");
    setEmail(employee.email ?? "");
    setJobTitle(employee.jobTitle);
    setDepartmentId(employee.department?.id ?? "");
    setAssignedManagerId(employee.assignedManager?.id ?? "");
    setLinkedUserId(employee.user?.id ?? "");
    setSelectedBranchId(employee.branch.id);
    setSalary(String(employee.monthlySalaryPaisa));
    setError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const body: Record<string, unknown> = {
      branchId: selectedBranchId,
      fullName,
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
      cnic: cnic || undefined,
      jobTitle,
      departmentId: departmentId || undefined,
      assignedManagerId: assignedManagerId || undefined,
      linkedUserId: linkedUserId || undefined,
      joiningDate,
      monthlySalaryPaisa: Number(salary),
    };
    if (editing) {
      delete body.joiningDate;
    }

    try {
      const response = await fetch(
        editing ? `/api/employees/${editing.id}` : "/api/employees",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Employee save nahi hua");
        return;
      }
      setNotice(editing ? "Employee update ho gaya." : "Employee create ho gaya.");
      reset();
      router.refresh();
    } catch (requestError) {
      console.error(requestError);
      setError("Server se rabta nahi ho saka.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(employee: Employee, to: Employee["status"]) {
    if (!window.confirm(`${employee.fullName} ko ${to} karna hai?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/employees/${employee.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, reason: `${to} from employee management` }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Status change nahi hua");
        return;
      }
      setNotice("Employee status update ho gaya.");
      router.refresh();
    } catch (requestError) {
      console.error(requestError);
      setError("Status change nahi ho saka.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
      <section className="min-w-0 rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-white">Employee directory</h2>
            <p className="mt-1 text-sm text-slate-400">{visibleEmployees.length} records</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID, name, phone..."
              className="min-w-52 rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2 text-sm text-white" />
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}
              className="rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2 text-sm text-white">
              <option value="">All branches</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2 text-sm text-white">
              <option value="">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>

        {error && <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {notice && <p className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#1b2540] text-xs uppercase text-slate-500">
                <th className="pb-3">Employee</th>
                <th className="pb-3">Branch</th>
                <th className="pb-3">Department</th>
                <th className="pb-3">Salary</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleEmployees.map((employee) => (
                <tr key={employee.id} className="border-b border-[#1b2540]/70 last:border-0">
                  <td className="py-4">
                    <p className="font-medium text-white">{employee.fullName}</p>
                    <p className="text-xs text-slate-500">{employee.employeeCode} · {employee.jobTitle}</p>
                  </td>
                  <td className="py-4 text-slate-300">{employee.branch.name}</td>
                  <td className="py-4 text-slate-400">{employee.department?.name ?? "-"}</td>
                  <td className="py-4 text-slate-300">Rs. {(employee.monthlySalaryPaisa / 100).toLocaleString("en-PK")}</td>
                  <td className="py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${
                      employee.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300"
                      : employee.status === "INACTIVE" ? "bg-amber-500/15 text-amber-300"
                      : "bg-red-500/15 text-red-300"
                    }`}>{employee.status}</span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canUpdate && <button type="button" onClick={() => edit(employee)}
                        className="rounded-lg border border-[#293650] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5">Edit</button>}
                      {canDeactivate && employee.status !== "TERMINATED" && (
                        <button type="button" disabled={busy}
                          onClick={() => changeStatus(employee, employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                          className="rounded-lg border border-[#293650] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5">
                          {employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleEmployees.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500">Koi employee nahi mila.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(canCreate || canUpdate) && (
        <section className="h-fit rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
          <div className="mb-5 flex items-start justify-between">
            <div><h2 className="font-semibold text-white">{editing ? "Edit employee" : "Add employee"}</h2>
              <p className="mt-1 text-sm text-slate-400">Employee details aur account link.</p></div>
            {editing && <button type="button" onClick={reset} className="text-xs text-slate-400 hover:text-white">Cancel</button>}
          </div>
          <form onSubmit={submit} className="space-y-3">
            <input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name"
              className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white" />
            <input required value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Job designation"
              className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white" />
            <div className="grid grid-cols-2 gap-3">
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone"
                className="rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white" />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email"
                className="rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white" />
            </div>
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address"
              className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white" />
            <input value={cnic} onChange={(event) => setCnic(event.target.value)} placeholder="CNIC (optional)"
              className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white" />
            <select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} disabled={Boolean(editing)}
              className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white">
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}
              className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white">
              <option value="">Select department</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <select value={assignedManagerId} onChange={(event) => setAssignedManagerId(event.target.value)}
              className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white">
              <option value="">Assigned manager (optional)</option>
              {loginUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
            </select>
            <select value={linkedUserId} onChange={(event) => setLinkedUserId(event.target.value)}
              className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white">
              <option value="">Link login account (optional)</option>
              {loginUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.username}</option>)}
            </select>
            {!editing && (
              <input type="date" required value={joiningDate} onChange={(event) => setJoiningDate(event.target.value)}
                className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white" />
            )}
            <input required type="number" min="0" value={salary} onChange={(event) => setSalary(event.target.value)}
              placeholder="Monthly salary in paisa"
              className="w-full rounded-lg border border-[#293650] bg-[#0b1020] px-3 py-2.5 text-sm text-white" />
            <button type="submit" disabled={busy}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-60">
              {busy ? "Saving..." : editing ? "Update employee" : "Add employee"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
