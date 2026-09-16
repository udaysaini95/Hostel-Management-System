import { z } from "zod";
import { idParamsSchema, requiredText } from "./commonSchemas.js";

const codeSchema = (label) =>
  z
    .string(`${label} must be text`)
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z][A-Z0-9-]{0,19}$/,
      `${label} must start with a letter and contain only letters, numbers, or hyphens`
    );

const hostelAndBlockParams = z.strictObject({
  id: z.coerce.number().int().positive(),
  blockId: z.coerce.number().int().positive(),
});

const hostelAndRoomParams = z.strictObject({
  id: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
});

const roomNumberSchema = z
  .string("Room number must be text")
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9][A-Z0-9-]{0,19}$/,
    "Room number may contain only letters, numbers, or hyphens"
  );

export const hostelInventoryRequestSchema = {
  params: idParamsSchema,
};

export const blockCreateRequestSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    code: codeSchema("Block code"),
    name: requiredText("Block name", 255),
  }),
};

export const blockUpdateRequestSchema = {
  params: hostelAndBlockParams,
  body: z.strictObject({
    name: requiredText("Block name", 255),
  }),
};

export const blockStatusRequestSchema = {
  params: hostelAndBlockParams,
  body: z.strictObject({ isActive: z.boolean() }),
};

const roomFields = {
  floor: z.number().int().min(0).max(200),
  capacity: z.number().int().min(1).max(20),
};

export const roomCreateRequestSchema = {
  params: hostelAndBlockParams,
  body: z.strictObject({
    roomNumber: roomNumberSchema,
    ...roomFields,
  }),
};

export const roomUpdateRequestSchema = {
  params: hostelAndRoomParams,
  body: z.strictObject(roomFields),
};

export const roomStatusRequestSchema = {
  params: hostelAndRoomParams,
  body: z.strictObject({ isActive: z.boolean() }),
};
