import { z } from "zod";
import { hostelCodeSchema, idParamsSchema, requiredText } from "./commonSchemas.js";

export const roomInventoryRequestSchema = {
  query: z.strictObject({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    hostelCode: hostelCodeSchema.optional(),
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

export const transferRoomAllocationRequestSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    roomId: z.number().int().positive(),
    reason: requiredText("Transfer reason", 500).min(
      5,
      "Transfer reason must contain at least 5 characters"
    ),
  }),
};
