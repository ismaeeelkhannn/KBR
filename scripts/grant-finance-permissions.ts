import "dotenv/config";
import { db } from "../src/lib/db";

const permissions = [
  { code: "inventory.manage", description: "Inventory manage (purchases)" },
  { code: "expenses.manage", description: "Expenses manage" },
  { code: "reports.view", description: "Reports dekhna" },
  { code: "reports.close", description: "Din band karna" },
  { code: "complaints.manage", description: "Complaints manage" },
  { code: "delivery.manage", description: "Delivery manage" },
  { code: "employees.manage", description: "Employees manage" },
  { code: "employee.view", description: "Employee profiles aur history dekhna" },
  { code: "employee.create", description: "Naya employee banana" },
  { code: "employee.update", description: "Employee information update karna" },
  { code: "employee.deactivate", description: "Employee deactivate ya terminate karna" },
  { code: "attendance.view", description: "Employee attendance dekhna" },
  { code: "attendance.manage", description: "Employee attendance manage karna" },
  { code: "attendance.correct", description: "Attendance correction karna" },
  { code: "activity.view", description: "Employee activities dekhna" },
  { code: "activity.create", description: "Employee activity record karna" },
  { code: "complaint.view", description: "Employee complaints dekhna" },
  { code: "complaint.create", description: "Employee complaint register karna" },
  { code: "complaint.resolve", description: "Employee complaint resolve karna" },
  { code: "performance.view", description: "Employee performance dekhna" },
  { code: "performance.evaluate", description: "Employee performance evaluate karna" },
  { code: "warning.view", description: "Employee warnings dekhna" },
  { code: "warning.create", description: "Employee warning issue karna" },
  { code: "salary.view", description: "Employee salary aur ledger dekhna" },
  { code: "salary.manage", description: "Employee salary aur transactions manage karna" },
  { code: "salary.approve", description: "Salary aur payroll approve karna" },
  { code: "payroll.view", description: "Payroll reports dekhna" },
  { code: "payroll.export", description: "Payroll reports export karna" },
  { code: "employee.audit.view", description: "Employee audit history dekhna" },
];

async function main() {
  const [ownerRole, managerRole] = await Promise.all([
    db.role.findUnique({ where: { code: "OWNER" } }),
    db.role.findUnique({ where: { code: "MANAGER" } }),
  ]);
  if (!ownerRole) throw new Error("Role OWNER nahi mila");
  if (!managerRole) throw new Error("Role MANAGER nahi mila");

  const managerPermissionCodes = [
    "inventory.manage",
    "expenses.manage",
    "reports.view",
    "complaints.manage",
    "delivery.manage",
    "employees.manage",
    "employee.view",
    "employee.create",
    "employee.update",
    "employee.deactivate",
    "attendance.view",
    "attendance.manage",
    "attendance.correct",
    "activity.view",
    "activity.create",
    "complaint.view",
    "complaint.create",
    "complaint.resolve",
    "performance.view",
    "performance.evaluate",
    "warning.view",
    "warning.create",
    "salary.view",
    "salary.manage",
    "payroll.view",
  ];

  await db.$transaction(async (tx) => {
    for (const permission of permissions) {
      await tx.permission.upsert({
        where: { code: permission.code },
        update: {},
        create: permission,
      });
    }

    const [allGranted, managerGranted] = await Promise.all([
      tx.permission.findMany({
        where: { code: { in: permissions.map((permission) => permission.code) } },
        select: { id: true },
      }),
      tx.permission.findMany({
        where: { code: { in: managerPermissionCodes } },
        select: { id: true },
      }),
    ]);

    await tx.rolePermission.createMany({
      data: allGranted.map((permission) => ({
        roleId: ownerRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });

    await tx.rolePermission.createMany({
      data: managerGranted.map((permission) => ({
        roleId: managerRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  });

  console.log("Permissions grant ho gayi");
}

main()
  .catch((error: unknown) => {
    console.error(
      "Finance permission grant failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
