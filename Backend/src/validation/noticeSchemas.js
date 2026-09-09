import { z } from "zod";
import {
  NOTICE_AUDIENCE_TYPES,
  NOTICE_LIST_STATES,
  NOTICE_PRIORITIES,
  NOTICE_READ_STATES,
} from "../domain/notices.js";
import { USER_ROLES } from "../domain/roles.js";
import { idParamsSchema, requiredText } from "./commonSchemas.js";

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(50).default(10);
const positiveId = z.coerce.number().int().positive();
const priority = z.enum(Object.values(NOTICE_PRIORITIES));
const audienceType = z.enum(Object.values(NOTICE_AUDIENCE_TYPES));

const audience = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal(NOTICE_AUDIENCE_TYPES.ALL_RESIDENTS) }),
  z.strictObject({
    type: z.literal(NOTICE_AUDIENCE_TYPES.ROLE),
    role: z.enum(Object.values(USER_ROLES)),
  }),
  z.strictObject({
    type: z.literal(NOTICE_AUDIENCE_TYPES.HOSTEL),
    hostelId: positiveId,
  }),
  z.strictObject({
    type: z.literal(NOTICE_AUDIENCE_TYPES.BLOCK),
    hostelId: positiveId,
    blockId: positiveId,
  }),
]);

export const publishNoticeSchema = {
  body: z.strictObject({
    title: requiredText("Title", 200),
    body: requiredText("Body", 5000),
    priority: priority.default(NOTICE_PRIORITIES.NORMAL),
    audience,
    expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
  }),
};

export const ownNoticeListSchema = {
  query: z.strictObject({
    page,
    pageSize,
    state: z.enum(Object.values(NOTICE_LIST_STATES)).default(NOTICE_LIST_STATES.ACTIVE),
    readState: z.enum(Object.values(NOTICE_READ_STATES)).default(NOTICE_READ_STATES.ALL),
    priority: priority.optional(),
  }),
};

export const managedNoticeListSchema = {
  query: z.strictObject({
    page,
    pageSize,
    state: z.enum(Object.values(NOTICE_LIST_STATES)).default(NOTICE_LIST_STATES.ALL),
    priority: priority.optional(),
    audienceType: audienceType.optional(),
    hostelId: positiveId.optional(),
  }),
};

export const noticeResourceSchema = { params: idParamsSchema };
