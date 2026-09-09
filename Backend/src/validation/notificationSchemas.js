import { z } from "zod";
import { NOTIFICATION_READ_STATES } from "../domain/notifications.js";
import { idParamsSchema } from "./commonSchemas.js";

export const notificationListSchema = {
  query: z.strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    readState: z
      .enum(Object.values(NOTIFICATION_READ_STATES))
      .default(NOTIFICATION_READ_STATES.ALL),
  }),
};

export const notificationResourceSchema = { params: idParamsSchema };
