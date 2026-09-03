import { z } from "zod";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from "../domain/passwordPolicy.js";

export const requiredText = (label, maxLength) =>
  z
    .string(`${label} must be text`)
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} must contain at most ${maxLength} characters`);

export const optionalText = (label, maxLength) =>
  z
    .string(`${label} must be text`)
    .trim()
    .max(maxLength, `${label} must contain at most ${maxLength} characters`)
    .optional();

export const emailSchema = z
  .string("Email must be text")
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(255, "Email must contain at most 255 characters");

export const passwordSchema = z
  .string("Password must be text")
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must contain at least ${PASSWORD_MIN_LENGTH} characters`
  )
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_BYTES,
    `Password must contain at most ${PASSWORD_MAX_BYTES} UTF-8 bytes`
  );

export const hostelCodeSchema = z
  .string("Hostel code must be text")
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z][A-Z0-9-]{0,19}$/,
    "Hostel code must start with a letter and contain only letters, numbers, or hyphens"
  );

export const rollNoSchema = z
  .string("Roll number must be text")
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9][A-Z0-9 /-]{1,49}$/,
    "Enter a valid student roll number"
  );

export const secureTokenSchema = z
  .string("Token must be text")
  .regex(/^[A-Za-z0-9_-]{43}$/, "Enter a valid activation token");

export const idParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive("ID must be a positive integer"),
});
