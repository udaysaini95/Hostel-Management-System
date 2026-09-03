import { getStudentActivationEmailConfig } from "../config/studentActivationEmailConfig.js";
import { db } from "../db/index.js";
import { createAccessSession } from "../services/accessTokenService.js";
import {
  approveStudent,
  completeStudentActivation,
  requestStudentActivation,
  revokeStudentActivationToken,
  StudentActivationError,
} from "../services/studentActivationService.js";
import { sendStudentActivationEmail } from "../services/studentActivationEmailService.js";

const sendError = (res, error, operation) => {
  if (error instanceof StudentActivationError) {
    return res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
    });
  }

  if (error?.code === "23505") {
    return res.status(409).json({
      code: "STUDENT_IDENTITY_CONFLICT",
      message: "The student email or roll number is already in use",
    });
  }

  console.error(`${operation}:`, error);
  return res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "The request could not be completed",
  });
};

export const createStudentApproval = async (req, res) => {
  try {
    const result = await approveStudent(db, req.body, req.user.id);

    return res.status(201).json({
      message: "Student approved for account activation",
      ...result,
    });
  } catch (error) {
    return sendError(res, error, "Create Student Approval Error");
  }
};

export const requestActivation = async (req, res) => {
  try {
    const emailConfig = getStudentActivationEmailConfig();

    if (!emailConfig.enabled) {
      return res.status(503).json({
        code: "ACTIVATION_EMAIL_UNAVAILABLE",
        message: "Student activation email is not configured",
      });
    }

    const activation = await requestStudentActivation(db, req.body);

    if (activation.issued) {
      try {
        await sendStudentActivationEmail(emailConfig, activation);
      } catch (error) {
        await revokeStudentActivationToken(db, activation.tokenId);
        console.error("Student activation email delivery failed:", error.message);
      }
    }

    return res.status(202).json({
      message:
        "If the student details match an approved record, an activation email will be sent.",
    });
  } catch (error) {
    return sendError(res, error, "Request Student Activation Error");
  }
};

export const completeActivation = async (req, res) => {
  try {
    const result = await completeStudentActivation(db, req.body);
    const session = createAccessSession(result.user);

    return res.status(201).json({
      message: "Student account activated",
      ...session,
      ...result,
    });
  } catch (error) {
    return sendError(res, error, "Complete Student Activation Error");
  }
};
