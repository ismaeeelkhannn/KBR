import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * DEMO seed data.
 * - Sirf roles, permissions, ek DEMO branch aur 2 cash registers banata hai.
 * - Koi real menu, price, address ya recipe nahi.
 * - Idempotent: baar baar chalane se duplicate nahi banta (upsert use hota hai).
 */

const prisma = new PrismaClient();

const PERMISSIONS: { code: string; description: string }[] = [
  { code: "branches.view", description: "Branches dekhna" },
  { code: "branches.manage", description: "Branches banana aur edit karna" },
  { code: "users.manage", description: "Users aur access manage karna" },
  { code: "roles.manage", description: "Roles aur permissions manage karna" },
  { code: "pos.use", description: "POS chalana" },
  { code: "orders.create", description: "Order banana" },
  { code: "orders.cancel.request", description: "Cancellation request karna" },
  { code: "orders.cancel.approve", description: "Cancellation approve karna" },
  { code: "discounts.apply", description: "Discount lagana" },
  { code: "discounts.approve", description: "Bade discount approve karna" },
  { code: "refunds.request", description: "Refund request karna" },
  { code: "refunds.approve", description: "Refund approve karna" },
  { code: "kitchen.view", description: "Kitchen screen dekhna" },
  { code: "kitchen.update", description: "Kitchen order status update karna" },
  { code: "inventory.view", description: "Inventory dekhna" },
  { code: "inventory.adjust", description: "Stock adjustment karna" },
  { code: "recipes.manage", description: "Recipes manage karna" },
  { code: "purchases.manage", description: "Purchases aur suppliers manage karna" },
  { code: "cash.manage", description: "Cash shift chalana" },
  { code: "cash.reconcile", description: "Cash difference review aur approve karna" },
  { code: "expenses.manage", description: "Expenses manage karna" },
  { code: "accounting.view", description: "Accounting aur P&L dekhna" },
  { code: "employees.manage", description: "Employees manage karna" },
  { code: "complaints.manage", description: "Complaints manage karna" },
  { code: "delivery.manage", description: "Delivery orders manage karna" },
  { code: "reports.view", description: "Reports dekhna" },
  { code: "audit.view", description: "Audit logs dekhna" },
  { code: "settings.manage", description: "System settings manage karna" },
];

const ROLES: {
  code: string;
  name: string;
  description: string;
  permissions: string[] | "ALL";
}[] = [
  { code: "OWNER", name: "Owner", description: "Mukammal access", permissions: "ALL" },
  {
    code: "MANAGER",
    name: "Restaurant Manager",
    description: "Daily operations aur approvals",
    permissions: [
      "branches.view", "pos.use", "orders.create", "orders.cancel.request",
      "orders.cancel.approve", "discounts.apply", "discounts.approve",
      "refunds.request", "refunds.approve", "kitchen.view", "inventory.view",
      "cash.manage", "cash.reconcile", "employees.manage", "complaints.manage",
      "delivery.manage", "reports.view",
    ],
  },
  {
    code: "CASHIER",
    name: "Cashier",
    description: "Orders aur payments",
    permissions: ["pos.use", "orders.create", "orders.cancel.request", "refunds.request", "cash.manage"],
  },
  {
    code: "WAITER",
    name: "Waiter",
    description: "Table orders",
    permissions: ["pos.use", "orders.create", "orders.cancel.request"],
  },
  {
    code: "KITCHEN",
    name: "Kitchen Staff",
    description: "Kitchen orders",
    permissions: ["kitchen.view", "kitchen.update"],
  },
  {
    code: "STOREKEEPER",
    name: "Storekeeper",
    description: "Stock aur purchases",
    permissions: ["inventory.view", "inventory.adjust", "recipes.manage", "purchases.manage"],
  },
  {
    code: "ACCOUNTANT",
    name: "Accountant",
    description: "Financial records",
    permissions: ["accounting.view", "expenses.manage", "cash.reconcile", "reports.view"],
  },
  {
    code: "DELIVERY",
    name: "Delivery Staff",
    description: "Assigned deliveries",
    permissions: ["delivery.manage"],
  },
];

async function main() {
  console.log("DEMO seed shuru ho raha hai...");

  // 1. Permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }
  console.log(`✅ ${PERMISSIONS.length} permissions tayyar`);

  // 2. Roles aur role-permission mapping
  const allPermissions = await prisma.permission.findMany({ select: { id: true, code: true } });

  for (const role of ROLES) {
    const savedRole = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });

    const codes =
      role.permissions === "ALL"
        ? allPermissions.map((p) => p.code)
        : role.permissions;

    const permIds = allPermissions
      .filter((p) => codes.includes(p.code))
      .map((p) => p.id);

    await prisma.rolePermission.createMany({
      data: permIds.map((permissionId) => ({ roleId: savedRole.id, permissionId })),
      skipDuplicates: true,
    });
  }
  console.log(`✅ ${ROLES.length} roles tayyar`);

  // 3. DEMO branch (verify hone tak placeholder)
  const branch = await prisma.branch.upsert({
    where: { code: "DEMO-MAIN" },
    update: {},
    create: {
      code: "DEMO-MAIN",
      name: "DEMO Branch (Verify Required)",
      address: "DEMO: address owner se confirm karna hai",
      timezone: "Asia/Karachi",
      isActive: true,
    },
  });
  console.log("✅ DEMO branch tayyar");

  // 4. Cash registers
  for (const code of ["C1", "C2"]) {
    await prisma.cashRegister.upsert({
      where: { branchId_code: { branchId: branch.id, code } },
      update: {},
      create: { branchId: branch.id, code, name: `DEMO Counter ${code}` },
    });
  }
  console.log("✅ DEMO cash registers tayyar");

  console.log("Seed mukammal.");
}

main()
  .catch((error) => {
    console.error("❌ Seed FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
