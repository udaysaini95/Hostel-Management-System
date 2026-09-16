import { z } from "zod";
import { HOSTEL_RESIDENT_TYPES } from "../domain/hostels.js";
import { hostelCodeSchema, idParamsSchema, requiredText } from "./commonSchemas.js";

const residentTypeSchema = z.enum(Object.values(HOSTEL_RESIDENT_TYPES));
const addressSchema = z
  .string("Address must be text")
  .trim()
  .max(1000, "Address must contain at most 1000 characters");

export const hostelListRequestSchema = {
  query: z.strictObject({
    includeInactive: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  }),
};

export const hostelCreateRequestSchema = {
  body: z.strictObject({
    code: hostelCodeSchema,
    name: requiredText("Hostel name", 255).min(2),
    residentType: residentTypeSchema,
    address: addressSchema.optional(),
  }),
};

export const hostelUpdateRequestSchema = {
  params: idParamsSchema,
  body: z
    .strictObject({
      name: requiredText("Hostel name", 255).min(2).optional(),
      residentType: residentTypeSchema.optional(),
      address: addressSchema.optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "Provide at least one hostel field to update",
    }),
};

export const hostelStatusRequestSchema = {
  params: idParamsSchema,
  body: z.strictObject({ isActive: z.boolean() }),
};
