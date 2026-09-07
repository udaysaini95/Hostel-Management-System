import { z } from "zod";
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} from "../domain/complaintWorkflow.js";
import {
  hostelCodeSchema,
  idParamsSchema,
  requiredText,
} from "./commonSchemas.js";

const categoryCodeSchema = z
  .string("Category code must be text")
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9_]{1,49}$/,
    "Enter a valid complaint category"
  );

const searchSchema = z
  .string("Search must be text")
  .trim()
  .min(1, "Search cannot be blank")
  .max(100, "Search must contain at most 100 characters")
  .optional();

export const complaintCreateRequestSchema = {
  body: z.strictObject({
    categoryCode: categoryCodeSchema,
    location: requiredText("Location", 255),
    description: requiredText("Description", 2000).pipe(
      z.string().min(10, "Description must contain at least 10 characters")
    ),
    requestedPriority: z.enum(Object.values(COMPLAINT_PRIORITIES)).optional(),
    hostelCode: hostelCodeSchema.optional(),
    roomId: z.coerce.number().int().positive().optional(),
  }),
};

const complaintListQuery = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: searchSchema,
  hostelCode: hostelCodeSchema.optional(),
  categoryCode: categoryCodeSchema.optional(),
  status: z.enum(Object.values(COMPLAINT_STATUSES)).optional(),
  priority: z.enum(Object.values(COMPLAINT_PRIORITIES)).optional(),
  slaState: z.enum(["all", "open", "breached"]).default("all"),
  sortBy: z
    .enum(["createdAt", "slaDeadline", "priority"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const complaintListRequestSchema = { query: complaintListQuery };

export const complaintDetailRequestSchema = { params: idParamsSchema };
