import { z } from "zod";
import { optionalText, requiredText } from "./commonSchemas.js";

export const secureGatePassVerificationSchema = {
  body: z.strictObject({
    credential: requiredText("Gate-pass credential", 200),
  }),
};

export const gateMovementRequestSchema = {
  body: z.strictObject({
    credential: requiredText("Gate-pass credential", 200),
    action: z.enum(["exit", "return"]),
    idempotencyKey: requiredText("Idempotency key", 100).regex(
      /^[A-Za-z0-9][A-Za-z0-9._:-]{15,99}$/,
      "Idempotency key must contain between 16 and 100 safe characters"
    ),
    note: optionalText("Gate note", 500),
  }),
};

const pageSchema = z.coerce.number().int().positive().default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);
const optionalBooleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
const optionalHostelCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9-]{0,19}$/, "Hostel code is invalid")
  .optional();

export const outsideRosterQuerySchema = {
  query: z.strictObject({
    page: pageSchema,
    pageSize: pageSizeSchema,
    search: z.string().trim().max(100).optional(),
    hostelCode: optionalHostelCode,
    overdue: optionalBooleanQuery,
  }),
};

export const gateMovementHistoryQuerySchema = {
  query: z
    .strictObject({
      page: pageSchema,
      pageSize: pageSizeSchema,
      search: z.string().trim().max(100).optional(),
      hostelCode: optionalHostelCode,
      movement: z.enum(["exit", "return"]).optional(),
      overrideOnly: optionalBooleanQuery,
      from: z.iso.datetime({ offset: true }).optional(),
      to: z.iso.datetime({ offset: true }).optional(),
    })
    .refine(
      (query) =>
        !query.from ||
        !query.to ||
        new Date(query.from).getTime() <= new Date(query.to).getTime(),
      { message: "From must be before or equal to To", path: ["to"] }
    ),
};

export const expireGatePassesSchema = {
  body: z.strictObject({
    hostelCode: optionalHostelCode,
    limit: z.coerce.number().int().min(1).max(500).default(100),
  }),
};

export const gateOverrideRequestSchema = {
  body: z.strictObject({
    leaveRequestId: z.coerce.number().int().positive(),
    action: z.enum(["exit", "return"]),
    reason: requiredText("Override reason", 1000).min(
      10,
      "Override reason must contain at least 10 characters"
    ),
    idempotencyKey: requiredText("Idempotency key", 100).regex(
      /^[A-Za-z0-9][A-Za-z0-9._:-]{15,99}$/,
      "Idempotency key must contain between 16 and 100 safe characters"
    ),
  }),
};
