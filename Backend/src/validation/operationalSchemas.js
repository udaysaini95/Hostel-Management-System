import { z } from "zod";
import {
  idParamsSchema,
  optionalText,
  requiredText,
} from "./commonSchemas.js";

const complaintStatuses = ["Created", "In Progress", "Resolved", "Closed"];
const messIssueStatuses = ["Pending", "In Progress", "Resolved"];

const isCalendarDate = (value) => {
  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const dateString = z
  .string("Date must be text")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine(isCalendarDate, "Enter a valid date");

const menuDateString = z
  .string("Date must be text")
  .refine(
    (value) =>
      isCalendarDate(value) ||
      z.iso.datetime({ offset: true }).safeParse(value).success,
    "Date must be a valid YYYY-MM-DD date or ISO timestamp"
  );

const mealValue = z.union([
  requiredText("Meal", 1000),
  z.array(requiredText("Meal item", 100)).min(1).max(30),
]);

export const complaintCreationSchema = {
  body: z.strictObject({
    type: requiredText("Complaint type", 100),
    room: requiredText("Room", 50),
    description: requiredText("Description", 2000),
    priority: z
      .enum(["P0 - Critical", "P1 - High", "P2 - Medium", "P3 - Low"])
      .optional(),
  }),
};

export const complaintStatusSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    status: z.enum(complaintStatuses),
    resolutionNote: optionalText("Resolution note", 2000),
  }),
};

export const complaintVerificationSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    status: z.enum(["Created", "Closed"]),
    note: optionalText("Verification note", 2000),
  }),
};

export const leaveApplicationSchema = {
  body: z
    .strictObject({
      reason: requiredText("Reason", 1000),
      fromDate: dateString,
      toDate: dateString,
    })
    .refine((value) => value.toDate >= value.fromDate, {
      path: ["toDate"],
      message: "Return date cannot be before departure date",
    }),
};

export const menuRequestSchema = {
  body: z.strictObject({
    date: menuDateString.optional(),
    breakfast: mealValue,
    lunch: mealValue,
    dinner: mealValue,
  }),
};

export const messFeedbackSchema = {
  body: z.strictObject({
    rating: z.coerce.number().int().min(1).max(5),
    mealType: requiredText("Meal type", 100),
    foodItem: requiredText("Food item", 255),
  }),
};

export const messIssueCreationSchema = {
  body: z.strictObject({
    issueType: requiredText("Issue type", 100),
    mealType: requiredText("Meal type", 100),
    description: requiredText("Description", 2000),
  }),
};

export const messIssueStatusSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    status: z.enum(messIssueStatuses),
  }),
};

export const gatePassVerificationSchema = {
  body: z.strictObject({
    identifier: requiredText("Pass code, roll number, or email", 255),
  }),
};

export const gateActionSchema = {
  body: z.strictObject({
    leaveId: z.coerce.number().int().positive("Leave ID must be positive"),
    action: z.enum(["EXIT", "ENTRY"]),
    remarks: optionalText("Remarks", 500),
  }),
};

export const resourceIdSchema = { params: idParamsSchema };
