import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD format mein do");
const cnic = z.string().trim().regex(/^\d{5}-\d{7}-\d$/, "CNIC format 12345-1234567-1").or(z.literal(""));
const email = z.string().trim().max(120).or(z.literal(""));

export const employeeCreateSchema = z.object({
  branchId: z.string().min(1),
  fullName: z.string().trim().min(2).max(100),
  jobTitle: z.string().trim().min(2).max(60),
  joiningDate: dateStr,
  monthlySalaryPaisa: z.number().int().nonnegative(),
  phone: z.string().trim().max(20).optional(),
  email: email.optional(),
  address: z.string().trim().max(300).optional(),
  cnic: cnic.optional(),
  emergencyContact: z.string().trim().max(100).optional(),
  emergencyPhone: z.string().trim().max(20).optional(),
  profilePictureUrl: z.string().trim().max(500).optional(),
  departmentId: z.string().min(1).optional(),
  assignedManagerId: z.string().min(1).optional(),
  linkedUserId: z.string().min(1).optional(),
});

export const employeeUpdateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    jobTitle: z.string().trim().min(2).max(60).optional(),
    joiningDate: dateStr.optional(),
    monthlySalaryPaisa: z.number().int().nonnegative().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    email: email.nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    cnic: cnic.nullable().optional(),
    emergencyContact: z.string().trim().max(100).nullable().optional(),
    emergencyPhone: z.string().trim().max(20).nullable().optional(),
    profilePictureUrl: z.string().trim().max(500).nullable().optional(),
    departmentId: z.string().min(1).nullable().optional(),
    assignedManagerId: z.string().min(1).nullable().optional(),
    linkedUserId: z.string().min(1).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "Kam az kam ek field do");

export const employeeStatusSchema = z.object({
  to: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]),
  reason: z.string().trim().min(3).max(200).optional(),
});

export const employeeListSchema = z.object({
  branchId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
  departmentId: z.string().optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});