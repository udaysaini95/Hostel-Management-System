import { z } from "zod";
import { AUDIT_CATEGORIES } from "../domain/auditEvents.js";

const filterText = (label, maxLength) =>
  z
    .string(`${label} must be text`)
    .trim()
    .min(1, `${label} cannot be blank`)
    .max(maxLength, `${label} is too long`)
    .optional();

export const auditEventQuerySchema = {
  query: z
    .strictObject({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
      actorId: z.coerce.number().int().positive().optional(),
      category: z.enum(Object.values(AUDIT_CATEGORIES)).optional(),
      action: filterText("Action", 100),
      resourceType: filterText("Resource type", 100),
      resourceId: filterText("Resource ID", 100),
      from: z.iso.datetime({ offset: true }).optional(),
      to: z.iso.datetime({ offset: true }).optional(),
    })
    .refine(
      (query) =>
        !query.from ||
        !query.to ||
        new Date(query.to).getTime() >= new Date(query.from).getTime(),
      {
        path: ["to"],
        message: "End date cannot be before start date",
      }
    ),
};
