import { z } from "zod";
import { phoneSchema, requiredText } from "./commonSchemas.js";

export const studentProfileReadRequestSchema = {
  query: z.strictObject({}),
};

export const studentProfileUpdateRequestSchema = {
  body: z
    .strictObject({
      phone: phoneSchema().optional(),
      guardianName: requiredText("Guardian name", 255).optional(),
      guardianPhone: phoneSchema("Guardian phone number").optional(),
    })
    .refine((values) => Object.keys(values).length > 0, {
      message: "Provide at least one profile field to update",
    }),
};
