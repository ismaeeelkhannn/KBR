import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import { FinanceError } from "@/modules/finance/finance.service";
import type { RolePermissionsUpdateInput } from "./admin-roles.schemas";

async function assertCanManageRoles(userId: string) {
  if (!(await userHasPermission(userId, "roles.manage"))) {
    throw new FinanceError(403, "Roles manage karne ki permission nahi hai");
  }
}

export async function getAdminRoleDirectory(userId: string) {
  await assertCanManageRoles(userId);

  const [roles, permissions, actor] = await Promise.all([
    db.role.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        _count: { select: { users: true } },
        permissions: {
          select: {
            permission: {
              select: { id: true, code: true, description: true },
            },
          },
          orderBy: { permission: { code: "asc" } },
        },
      },
    }),
    db.permission.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, description: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    }),
  ]);

  return {
    roles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissionIds: role.permissions.map(({ permission }) => permission.id),
      permissionCodes: role.permissions.map(({ permission }) => permission.code),
    })),
    permissions,
    actorRoleId: actor?.roleId ?? null,
  };
}

export async function updateAdminRolePermissions(
  actorId: string,
  roleId: string,
  input: RolePermissionsUpdateInput,
) {
  await assertCanManageRoles(actorId);

  try {
    return await db.$transaction(
      async (tx) => {
        const [actor, role, matchedPermissions] = await Promise.all([
          tx.user.findUnique({
            where: { id: actorId },
            select: { roleId: true },
          }),
          tx.role.findUnique({
            where: { id: roleId },
            select: {
              id: true,
              code: true,
              name: true,
              permissions: {
                select: {
                  permission: { select: { id: true, code: true } },
                },
                orderBy: { permission: { code: "asc" } },
              },
            },
          }),
          tx.permission.findMany({
            where: { id: { in: input.permissionIds } },
            select: { id: true, code: true },
            orderBy: { code: "asc" },
          }),
        ]);

        if (!actor) throw new FinanceError(401, "Session user nahi mila");
        const canManageRoles = await tx.rolePermission.count({
          where: {
            roleId: actor.roleId,
            permission: { code: "roles.manage" },
          },
        });
        if (canManageRoles === 0) {
          throw new FinanceError(403, "Roles manage karne ki permission nahi hai");
        }
        if (!role) throw new FinanceError(404, "Role nahi mila");
        if (role.code === "OWNER") {
          throw new FinanceError(409, "Owner role ki permissions protected hain");
        }
        if (actor.roleId === roleId) {
          throw new FinanceError(
            409,
            "Apne current role ki permissions change nahi kar sakte",
          );
        }
        if (matchedPermissions.length !== input.permissionIds.length) {
          throw new FinanceError(422, "Koi permission nahi mili");
        }

        const beforeCodes = role.permissions
          .map(({ permission }) => permission.code)
          .sort();
        const afterCodes = matchedPermissions.map(({ code }) => code);

        await tx.rolePermission.deleteMany({ where: { roleId } });
        if (matchedPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: matchedPermissions.map(({ id }) => ({
              roleId,
              permissionId: id,
            })),
          });
        }

        await writeAudit(tx, {
          actorId,
          action: "ROLE_PERMISSIONS_UPDATED",
          entityType: "Role",
          entityId: roleId,
          before: { permissionCodes: beforeCodes },
          after: { permissionCodes: afterCodes },
        });

        return {
          id: role.id,
          code: role.code,
          name: role.name,
          permissionIds: matchedPermissions.map(({ id }) => id),
          permissionCodes: afterCodes,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new FinanceError(409, "Role data badal gaya; dobara try karein");
    }
    throw error;
  }
}
