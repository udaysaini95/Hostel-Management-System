import { z } from "zod";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import { hostelCodeSchema } from "./commonSchemas.js";

const optionalFilterText = (label, maxLength) =>
  z
    .string(`${label} must be text`)
    .trim()
    .min(1, `${label} cannot be blank`)
    .max(maxLength, `${label} must contain at most ${maxLength} characters`)
    .optional();

const blockCodeSchema = z
  .string("Block code must be text")
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z][A-Z0-9-]{0,19}$/,
    "Block code must start with a letter and contain only letters, numbers, or hyphens"
  );

const roomNumberSchema = z
  .string("Room number must be text")
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9][A-Z0-9-]{0,19}$/,
    "Room number must contain only letters, numbers, or hyphens"
  );

export const residentDirectoryRequestSchema = {
  query: z.strictObject({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: optionalFilterText("Search", 100),
    hostelCode: hostelCodeSchema.optional(),
    blockCode: blockCodeSchema.optional(),
    roomNumber: roomNumberSchema.optional(),
    accountStatus: z.enum(Object.values(ACCOUNT_STATUSES)).optional(),
  }),
};
