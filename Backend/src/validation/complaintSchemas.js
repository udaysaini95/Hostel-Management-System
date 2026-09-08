import { z } from "zod";
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} from "../domain/complaintWorkflow.js";
import {
  hostelCodeSchema,
  idParamsSchema,
  requiredText,
} from "./commonSchemas.js";

const categoryCodeSchema = z
  .string("Category code must be text")
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9_]{1,49}$/,
    "Enter a valid complaint category"
  );

const searchSchema = z
  .string("Search must be text")
  .trim()
  .min(1, "Search cannot be blank")
  .max(100, "Search must contain at most 100 characters")
  .optional();

const timestampSchema = z.iso.datetime({ offset: true });

const createComplaintListQuery = ({
  defaultSortBy = "createdAt",
  defaultSortOrder = "desc",
} = {}) =>
  z
    .strictObject({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      search: searchSchema,
      hostelCode: hostelCodeSchema.optional(),
      categoryCode: categoryCodeSchema.optional(),
      status: z.enum(Object.values(COMPLAINT_STATUSES)).optional(),
      priority: z.enum(Object.values(COMPLAINT_PRIORITIES)).optional(),
      slaState: z.enum(["all", "open", "breached"]).default("all"),
      sortBy: z
        .enum(["createdAt", "updatedAt", "slaDeadline", "priority"])
        .default(defaultSortBy),
      sortOrder: z.enum(["asc", "desc"]).default(defaultSortOrder),
      createdFrom: timestampSchema.optional(),
      createdTo: timestampSchema.optional(),
    })
    .refine(
      (value) =>
        !value.createdFrom ||
        !value.createdTo ||
        new Date(value.createdFrom) <= new Date(value.createdTo),
      {
        path: ["createdTo"],
        message: "Created-to timestamp must not be before created-from",
      }
    );

export const complaintCreateRequestSchema = {
  body: z.strictObject({
    categoryCode: categoryCodeSchema,
    location: requiredText("Location", 255),
    description: requiredText("Description", 2000).pipe(
      z.string().min(10, "Description must contain at least 10 characters")
    ),
    requestedPriority: z.enum(Object.values(COMPLAINT_PRIORITIES)).optional(),
    hostelCode: hostelCodeSchema.optional(),
    roomId: z.coerce.number().int().positive().optional(),
  }),
};

const complaintListQuery = createComplaintListQuery({
  defaultSortBy: "updatedAt",
});

export const complaintListRequestSchema = { query: complaintListQuery };

export const complaintWorkQueueRequestSchema = {
  query: createComplaintListQuery({
    defaultSortBy: "priority",
    defaultSortOrder: "asc",
  }),
};

export const complaintAssigneeListRequestSchema = {
  query: z.strictObject({ hostelCode: hostelCodeSchema }),
};

export const complaintMetricsRequestSchema = {
  query: z.strictObject({ hostelCode: hostelCodeSchema.optional() }),
};

export const complaintAssignmentRequestSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    assigneeUserId: z.coerce
      .number()
      .int()
      .positive("Assignee user ID must be positive"),
    reason: requiredText("Reason", 500)
      .pipe(z.string().min(5, "Reason must contain at least 5 characters"))
      .optional(),
  }),
};

export const complaintDetailRequestSchema = { params: idParamsSchema };

export const complaintResolutionRequestSchema = {
  body: z.strictObject({
    resolutionNote: requiredText("Resolution note", 1000).pipe(
      z.string().min(10, "Resolution note must contain at least 10 characters")
    ),
  }),
};

export const complaintVerificationRequestSchema = {
  params: idParamsSchema,
  body: z
    .strictObject({
      action: z.enum(["close", "reopen"]),
      reason: requiredText("Reason", 1000)
        .pipe(z.string().min(10, "Reason must contain at least 10 characters"))
        .optional(),
    })
    .superRefine((value, context) => {
      if (value.action === "reopen" && !value.reason) {
        context.addIssue({
          code: "custom",
          path: ["reason"],
          message: "Explain why the complaint needs to be reopened",
        });
      }
    }),
};

export const complaintAttachmentRequestSchema = {
  params: z.strictObject({
    id: z.coerce.number().int().positive("Complaint ID must be positive"),
    attachmentId: z.coerce
      .number()
      .int()
      .positive("Attachment ID must be positive"),
  }),
};
