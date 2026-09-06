import { z } from "zod";
import { hostelCodeSchema, idParamsSchema, requiredText } from "./commonSchemas.js";

const blockCodeSchema = z
  .string("Block code must be text")
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z][A-Z0-9-]{0,19}$/,
    "Block code must start with a letter and contain only letters, numbers, or hyphens"
  );

export const roomInventoryRequestSchema = {
  query: z.strictObject({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    hostelCode: hostelCodeSchema.optional(),
    blockCode: blockCodeSchema.optional(),
    availability: z.enum(["all", "available", "full"]).default("all"),
  }),
};

export const createRoomAllocationRequestSchema = {
  body: z.strictObject({
    studentUserId: z.number().int().positive(),
    roomId: z.number().int().positive(),
  }),
};

export const vacateRoomAllocationRequestSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    reason: requiredText("Vacate reason", 500).min(
      5,
      "Vacate reason must contain at least 5 characters"
    ),
  }),
};
