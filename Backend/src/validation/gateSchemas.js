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
