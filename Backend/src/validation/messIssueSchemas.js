import { z } from "zod";
import { MEAL_TYPE_ORDER } from "../domain/mess.js";
import {
  MESS_ISSUE_STATUSES,
  MESS_ISSUE_TYPES,
} from "../domain/messIssues.js";
import { idParamsSchema, optionalText, requiredText } from "./commonSchemas.js";

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(50).default(10);
const hostelId = z.coerce.number().int().positive();
const issueType = z.enum(Object.values(MESS_ISSUE_TYPES));
const mealType = z.enum(MEAL_TYPE_ORDER);
const status = z.enum(Object.values(MESS_ISSUE_STATUSES));

export const createMessIssueSchema = {
  body: z.strictObject({
    issueType,
    mealType,
    description: requiredText("Description", 2000).pipe(
      z.string().min(10, "Description must contain at least 10 characters")
    ),
  }),
};

export const ownMessIssueListSchema = {
  query: z.strictObject({ page, pageSize, status: status.optional() }),
};

export const managedMessIssueListSchema = {
  query: z.strictObject({
    page,
    pageSize,
    hostelId: hostelId.optional(),
    status: status.optional(),
    issueType: issueType.optional(),
    mealType: mealType.optional(),
  }),
};

export const messIssueStatusUpdateSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    status,
    note: optionalText("Note", 1000),
  }),
};

export const messIssueResourceSchema = { params: idParamsSchema };
