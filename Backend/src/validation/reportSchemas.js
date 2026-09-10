import { z } from "zod";
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} from "../domain/complaintWorkflow.js";
import { GATE_MOVEMENTS, LEAVE_STATUSES } from "../domain/leaveWorkflow.js";
import { MEAL_TYPES } from "../domain/mess.js";
import { REPORT_MAX_PERIOD_DAYS } from "../domain/reports.js";

const timestamp = z.iso.datetime({ offset: true });

const reportQuery = (filters = {}) => z
  .strictObject({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    from: timestamp.optional(),
    to: timestamp.optional(),
    hostelId: z.coerce.number().int().positive().optional(),
    ...filters,
  })
  .superRefine((query, context) => {
    if (!query.from || !query.to) return;

    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to < from) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Report end time cannot be before start time",
      });
      return;
    }

    const periodDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (periodDays > REPORT_MAX_PERIOD_DAYS) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: `Report period cannot exceed ${REPORT_MAX_PERIOD_DAYS} days`,
      });
    }
  });

export const complaintReportRequestSchema = {
  query: reportQuery({
    status: z.enum(Object.values(COMPLAINT_STATUSES)).optional(),
    priority: z.enum(Object.values(COMPLAINT_PRIORITIES)).optional(),
  }),
};

export const leaveReportRequestSchema = {
  query: reportQuery({
    status: z.enum(Object.values(LEAVE_STATUSES)).optional(),
    emergency: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  }),
};

export const gateReportRequestSchema = {
  query: reportQuery({
    movement: z.enum(Object.values(GATE_MOVEMENTS)).optional(),
  }),
};

export const messReportRequestSchema = {
  query: reportQuery({
    mealType: z.enum(Object.values(MEAL_TYPES)).optional(),
  }),
};
