import { z } from "zod";
import { idParamsSchema, requiredText } from "./commonSchemas.js";

const timestampWithTimezone = (label) =>
  z.iso.datetime({ offset: true, message: `${label} must be an ISO timestamp with a timezone` });

export const leaveCreateRequestSchema = {
  body: z
    .strictObject({
      reason: requiredText("Reason", 1000).min(
        5,
        "Reason must contain at least 5 characters"
      ),
      departureAt: timestampWithTimezone("Departure time"),
      expectedReturnAt: timestampWithTimezone("Expected return time"),
      isEmergency: z.boolean("Emergency flag must be true or false").default(false),
    })
    .refine(
      (value) =>
        new Date(value.expectedReturnAt).getTime() >
        new Date(value.departureAt).getTime(),
      {
        path: ["expectedReturnAt"],
        message: "Expected return time must be after departure time",
      }
    ),
};

export const leaveDecisionRequestSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    outcome: z.enum(["approved", "rejected"]),
    note: requiredText("Decision note", 1000).min(
      5,
      "Decision note must contain at least 5 characters"
    ),
  }),
};
