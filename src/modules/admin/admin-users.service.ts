import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import { hashPassword } from "@/modules/auth/password";
import { FinanceError } from "@/modules/finance/finance.service";
import { canAssignRole, canModifyExistingUser } from "./owner-guard";
import type {
  AdminUserCreateInput,
  AdminUserUpdateInput,
} from "./admin-users.schemas";

async function assertCanManageUsers(userId: string) {
  if (!(await userHasPermission(userId, "users.manage"))) {
    throw new FinanceError(403, "Users manage karne ki permission nahi hai");
  }
}

async function assertCanManageRoles(userId: string) {
  if (!(await userHasPermission(userId, "roles.manage"))) {
    throw new FinanceError(403, "Roles assign karne ki permission nahi hai");
  }
}

async function assertBranchIds(
  tx: Prisma.TransactionClient,
  branchIds: string[],
) {
  const activeCount = await tx.branch.count({
    where: {
      id: { in: branchIds },
      isActive: true,
      deletedAt: null,
    },
  });
  if (activeCount !== branchIds.length) {
    throw new FinanceError(422, "Koi branch missing ya inactive hai");
  }
}

async function getActorBranchIds(
  tx: Prisma.TransactionClient,
  actorId: string,
) {
  const access = await tx.userBranchAccess.findMany({
    where: {
      userId: actorId,
      branch: { isActive: true, deletedAt: null },
    },
    select: { branchId: true },
  });
  return access.map(({ branchId }) => branchId);
}

async function assertActorCanManageBranchIds(
  tx: Prisma.TransactionClient,
  actorId: string,
  branchIds: string[],
) {
  const actorBranchIds = await getActorBranchIds(tx, actorId);
  if (
    actorBranchIds.length === 0 ||
    branchIds.some((branchId) => !actorBranchIds.includes(branchId))
  ) {
    throw new FinanceError(403, "In branches manage karne ki permission nahi hai");
  }
}

async function ensureUsernameAvailable(
  tx: Prisma.TransactionClient,
  username: string,
  excludingUserId?: string,
) {
  const existing = await tx.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      ...(excludingUserId ? { id: { not: excludingUserId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new FinanceError(409, "Ye username pehle se use ho raha hai");
  }
}

async function getActorRoleCode(
  tx: Prisma.TransactionClient,
  actorId: string,
): Promise<string | null> {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { role: { select: { code: true } } },
  });
  return actor?.role.code ?? null;
}

function assertGuard(decision: { allowed: boolean; reason?: string }) {
  if (!decision.allowed) {
    throw new FinanceError(403, decision.reason ?? "Is kaam ki permission nahi hai");
  }
}

async function ensureRoleExists(tx: Prisma.TransactionClient, roleId: string) {
  const role = await tx.role.findUnique({
    where: { id: roleId },
    select: { id: true, code: true, name: true },
  });
  if (!role) throw new FinanceError(404, "Role nahi mila");
  return role;
}

export async function getAdminUserDirectory(userId: string) {
  await assertCanManageUsers(userId);

  const actorBranchAccess = await db.userBranchAccess.findMany({
    where: {
      userId,
      branch: { isActive: true, deletedAt: null },
    },
    select: { branchId: true },
  });
  const actorBranchIds = actorBranchAccess.map(({ branchId }) => branchId);
  if (actorBranchIds.length === 0) {
    throw new FinanceError(403, "Kisi active branch ka access zaroori hai");
  }

  const [users, roles, branches] = await Promise.all([
    db.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { branchAccess: { none: {} } },
          {
            AND: [
              { branchAccess: { some: { branchId: { in: actorBranchIds } } } },
              { branchAccess: { every: { branchId: { in: actorBranchIds } } } },
            ],
          },
        ],
      },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        username: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, code: true, name: true } },
        branchAccess: {
          select: { branch: { select: { id: true, name: true } } },
          orderBy: { branch: { name: "asc" } },
        },
      },
    }),
    db.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.branch.findMany({
      where: {
        id: { in: actorBranchIds },
        isActive: true,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    users: users.map((user) => ({
      ...user,
      branchAccess: user.branchAccess.map((access) => access.branch),
    })),
    roles,
    branches,
  };
}

export async function createAdminUser(
  actorId: string,
  input: AdminUserCreateInput,
) {
  await assertCanManageUsers(actorId);
  await assertCanManageRoles(actorId);
  const passwordHash = await hashPassword(input.password);

  try {
    return await db.$transaction(
      async (tx) => {
        await ensureUsernameAvailable(tx, input.username);
        const role = await ensureRoleExists(tx, input.roleId);
        assertGuard(
          canAssignRole(await getActorRoleCode(tx, actorId), role.code),
        );
        await assertBranchIds(tx, input.branchIds);
        await assertActorCanManageBranchIds(tx, actorId, input.branchIds);

        const user = await tx.user.create({
          data: {
            username: input.username,
            fullName: input.fullName,
            passwordHash,
            roleId: role.id,
            branchAccess: {
              create: input.branchIds.map((branchId) => ({ branchId })),
            },
          },
          select: {
            id: true,
            username: true,
            fullName: true,
            isActive: true,
            role: { select: { id: true, code: true, name: true } },
            branchAccess: {
              select: { branch: { select: { id: true, name: true } } },
            },
          },
        });

        await writeAudit(tx, {
          actorId,
          action: "USER_CREATED",
          entityType: "User",
          entityId: user.id,
          after: {
            username: user.username,
            role: user.role.code,
            branchIds: input.branchIds,
          },
        });

        return {
          ...user,
          branchAccess: user.branchAccess.map((access) => access.branch),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      throw new FinanceError(
        409,
        error.code === "P2002"
          ? "Ye username pehle se use ho raha hai"
          : "User data badal gaya; dobara try karein",
      );
    }
    throw error;
  }
}

export async function updateAdminUser(
  actorId: string,
  userId: string,
  input: AdminUserUpdateInput,
) {
  await assertCanManageUsers(actorId);
  if (input.roleId !== undefined) await assertCanManageRoles(actorId);
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : undefined;

  try {
    return await db.$transaction(
      async (tx) => {
        const before = await tx.user.findUnique({
          where: { id: userId },
          include: {
            role: { select: { id: true, code: true, name: true } },
            branchAccess: {
              select: { branch: { select: { id: true, name: true } } },
            },
          },
        });
        if (!before || before.deletedAt) {
          throw new FinanceError(404, "User nahi mila");
        }

        const actorRoleCode = await getActorRoleCode(tx, actorId);
        assertGuard(canModifyExistingUser(actorRoleCode, before.role.code));
        const nextRole =
          input.roleId === undefined
            ? before.role
            : await ensureRoleExists(tx, input.roleId);
        if (input.roleId !== undefined) {
          assertGuard(canAssignRole(actorRoleCode, nextRole.code));
        }
        const nextActive = input.isActive ?? before.isActive;
        const branchIds =
          input.branchIds ?? before.branchAccess.map((access) => access.branch.id);
        const actorBranchIds = await getActorBranchIds(tx, actorId);
        if (
          actorBranchIds.length === 0 ||
          before.branchAccess.some(
            (access) => !actorBranchIds.includes(access.branch.id),
          ) ||
          branchIds.some((branchId) => !actorBranchIds.includes(branchId))
        ) {
          throw new FinanceError(403, "Is user ke branch access manage nahi kar sakte");
        }

        if (input.username !== undefined) {
          await ensureUsernameAvailable(tx, input.username, userId);
        }
        if (input.branchIds !== undefined) {
          await assertBranchIds(tx, input.branchIds);
        }
        if (userId === actorId && (!nextActive || nextRole.id !== before.roleId)) {
          throw new FinanceError(409, "Apna account deactivate ya role change nahi kar sakte");
        }
        if (
          before.isActive &&
          before.role.code === "OWNER" &&
          (!nextActive || nextRole.code !== "OWNER")
        ) {
          const otherOwners = await tx.user.count({
            where: {
              id: { not: userId },
              isActive: true,
              deletedAt: null,
              role: { code: "OWNER" },
            },
          });
          if (otherOwners === 0) {
            throw new FinanceError(409, "Aakhri active Owner ko deactivate/demote nahi kar sakte");
          }
        }

        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            ...(input.username !== undefined ? { username: input.username } : {}),
            ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
            ...(input.roleId !== undefined ? { roleId: nextRole.id } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(passwordHash ? { passwordHash } : {}),
          },
          select: {
            id: true,
            username: true,
            fullName: true,
            isActive: true,
            role: { select: { id: true, code: true, name: true } },
            branchAccess: {
              select: { branch: { select: { id: true, name: true } } },
            },
          },
        });

        if (input.branchIds !== undefined) {
          await tx.userBranchAccess.deleteMany({ where: { userId } });
          await tx.userBranchAccess.createMany({
            data: input.branchIds.map((branchId) => ({ userId, branchId })),
          });
        }

        const accessChanged =
          input.roleId !== undefined ||
          input.branchIds !== undefined ||
          input.isActive !== undefined ||
          passwordHash !== undefined;
        if (accessChanged) {
          await tx.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        const oldBranchIds = before.branchAccess
          .map((access) => access.branch.id)
          .sort();
        await writeAudit(tx, {
          actorId,
          action: nextActive ? "USER_UPDATED" : "USER_DEACTIVATED",
          entityType: "User",
          entityId: userId,
          before: {
            username: before.username,
            fullName: before.fullName,
            role: before.role.code,
            isActive: before.isActive,
            branchIds: oldBranchIds,
          },
          after: {
            username: updated.username,
            fullName: updated.fullName,
            role: updated.role.code,
            isActive: updated.isActive,
            branchIds: [...branchIds].sort(),
          },
        });

        const reloaded = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            fullName: true,
            isActive: true,
            role: { select: { id: true, code: true, name: true } },
            branchAccess: {
              select: { branch: { select: { id: true, name: true } } },
            },
          },
        });
        return {
          ...reloaded,
          branchAccess: reloaded.branchAccess.map((access) => access.branch),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new FinanceError(409, "Username pehle se use ho raha hai");
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new FinanceError(409, "User data badal gaya; dobara try karein");
    }
    throw error;
  }
}
