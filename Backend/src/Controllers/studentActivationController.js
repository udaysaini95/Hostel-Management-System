import { getStudentActivationEmailConfig } from "../config/studentActivationEmailConfig.js";
import { db } from "../db/index.js";
import { createAccessSession } from "../services/accessTokenService.js";
import {
  approveStudent,
  completeStudentActivation,
  requestStudentActivation,
  revokeStudentActivationToken,
} from "../services/studentActivationService.js";
import { sendStudentActivationEmail } from "../services/studentActivationEmailService.js";
import {
  handleControllerError,
  sendApiError,
} from "../utils/apiErrors.js";

const sendError = (res, error, operation) => {
  if (error?.code === "23505") {
    return sendApiError(
      res,
      409,
      "STUDENT_IDENTITY_CONFLICT",
      "The student email or roll number is already in use"
    );
  }

  return handleControllerError(res, error, operation);
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
      return sendApiError(
        res,
        503,
        "ACTIVATION_EMAIL_UNAVAILABLE",
        "Student activation email is not configured"
      );
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
