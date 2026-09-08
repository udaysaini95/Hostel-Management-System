import { z } from "zod";
import { requiredText } from "./commonSchemas.js";

export const secureGatePassVerificationSchema = {
  body: z.strictObject({
    credential: requiredText("Gate-pass credential", 200),
  }),
};
