import { z } from "zod";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import { APPROVED_STUDENT_STATUSES } from "../domain/approvedStudentStatuses.js";
import { USER_ROLES } from "../domain/roles.js";
import {
  emailSchema,
  hostelCodeSchema,
  idParamsSchema,
  passwordSchema,
  requiredText,
  rollNoSchema,
  secureTokenSchema,
} from "./commonSchemas.js";

export const loginRequestSchema = {
  body: z.strictObject({
    email: emailSchema,
    password: z.string("Password must be text").min(1, "Password is required"),
  }),
};

export const staffInvitationRequestSchema = {
  body: z.strictObject({
    name: requiredText("Name", 255),
    email: emailSchema,
    role: z.enum([
      USER_ROLES.WARDEN,
      USER_ROLES.MAINTENANCE,
      USER_ROLES.GUARD,
    ]),
    hostelCodes: z.array(hostelCodeSchema).min(1).max(20),
    primaryHostelCode: hostelCodeSchema.optional(),
  }),
};

export const staffInvitationAcceptanceSchema = {
  body: z.strictObject({
    token: secureTokenSchema,
    password: passwordSchema,
  }),
};

export const accountStatusRequestSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    status: z.enum([
      ACCOUNT_STATUSES.ACTIVE,
      ACCOUNT_STATUSES.SUSPENDED,
    ]),
  }),
};

export const studentApprovalRequestSchema = {
  body: z.strictObject({
    name: requiredText("Name", 255),
    email: emailSchema,
    rollNo: rollNoSchema,
    hostelCode: hostelCodeSchema,
  }),
};

export const approvedStudentSearchRequestSchema = {
  query: z.strictObject({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z
      .string("Search must be text")
      .trim()
      .max(100, "Search must contain at most 100 characters")
      .optional(),
    hostelCode: hostelCodeSchema.optional(),
    status: z.enum(Object.values(APPROVED_STUDENT_STATUSES)).optional(),
  }),
};

export const approvedStudentRevocationRequestSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    reason: requiredText("Revocation reason", 500).min(
      5,
      "Revocation reason must contain at least 5 characters"
    ),
  }),
};

export const approvedStudentReinstatementRequestSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    reason: requiredText("Reinstatement reason", 500).min(
      5,
      "Reinstatement reason must contain at least 5 characters"
    ),
  }),
};

export const approvedStudentActivationReissueRequestSchema = {
  params: idParamsSchema,
};

export const studentActivationRequestSchema = {
  body: z.strictObject({
    email: emailSchema,
    rollNo: rollNoSchema,
  }),
};

export const studentActivationCompletionSchema = {
  body: z.strictObject({
    token: secureTokenSchema,
    password: passwordSchema,
  }),
};
