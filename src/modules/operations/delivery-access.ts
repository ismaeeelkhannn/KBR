export function isAssignedDeliveryRider(
  roleCode: string,
  assignedRiderId: string | null,
  userId: string
) {
  return roleCode === "DELIVERY" && assignedRiderId === userId;
}
