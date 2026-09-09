import { z } from "zod";
import { requiredText } from "./commonSchemas.js";

const calendarDate = z
  .string("Date must be text")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date");

const hostelId = z.coerce.number().int().positive("Hostel ID must be positive");
const mealItems = z.array(requiredText("Menu item", 100)).min(1).max(30);

export const publishMessMenuSchema = {
  params: z.strictObject({ date: calendarDate }),
  body: z.strictObject({
    hostelId,
    meals: z.strictObject({
      breakfast: mealItems,
      lunch: mealItems,
      snacks: mealItems.optional(),
      dinner: mealItems,
    }),
  }),
};

export const messMenuDateQuerySchema = {
  params: z.strictObject({ date: calendarDate }),
  query: z.strictObject({ hostelId: hostelId.optional() }),
};

export const messMenuRangeQuerySchema = {
  query: z
    .strictObject({
      from: calendarDate,
      to: calendarDate,
      hostelId: hostelId.optional(),
    })
    .refine((query) => query.from <= query.to, {
      path: ["to"],
      message: "To must be after or equal to From",
    })
    .refine((query) => {
      const from = Date.parse(`${query.from}T00:00:00.000Z`);
      const to = Date.parse(`${query.to}T00:00:00.000Z`);
      return to - from <= 62 * 24 * 60 * 60 * 1000;
    }, {
      path: ["to"],
      message: "Menu ranges cannot exceed 62 days",
    }),
};

export const createMessFeedbackSchema = {
  body: z.strictObject({
    menuId: hostelId,
    mealType: z.enum(["breakfast", "lunch", "snacks", "dinner"]),
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(1000).optional(),
  }),
};

export const messFeedbackSummarySchema = {
  query: z
    .strictObject({
      hostelId,
      from: calendarDate,
      to: calendarDate,
      mealType: z.enum(["breakfast", "lunch", "snacks", "dinner"]).optional(),
    })
    .refine((query) => query.from <= query.to, {
      path: ["to"],
      message: "To must be after or equal to From",
    }),
};
