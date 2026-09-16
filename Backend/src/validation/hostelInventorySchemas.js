import { z } from "zod";
import { idParamsSchema } from "./commonSchemas.js";

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

const roomFields = {
  floor: z.number().int().min(0).max(200),
  capacity: z.number().int().min(1).max(20),
};

export const roomCreateRequestSchema = {
  params: idParamsSchema,
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
