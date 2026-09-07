import { getStudentActivationEmailConfig } from "../config/studentActivationEmailConfig.js";
import { db } from "../db/index.js";
import {
  listStudentApprovalHostels,
  reinstateApprovedStudent,
  reissueApprovedStudentActivation,
  revokeApprovedStudent,
  searchApprovedStudents,
} from "../services/approvedStudentService.js";
import { importStudentApprovals } from "../services/studentImportService.js";
import { sendStudentActivationEmail } from "../services/studentActivationEmailService.js";
import { revokeStudentActivationToken } from "../services/studentActivationService.js";
import {
  handleControllerError,
  sendApiError,
} from "../utils/apiErrors.js";

export const listApprovedStudents = async (req, res) => {
  try {
    const result = await searchApprovedStudents(db, req.query);
    return res.json(result);
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "List Approved Students Error"
    );
  }
};

export const listApprovalHostels = async (_req, res) => {
  try {
    const result = await listStudentApprovalHostels(db);
    return res.json(result);
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "List Student Approval Hostels Error"
    );
  }
};

export const importApprovedStudents = async (req, res) => {
  try {
    if (!req.file) {
      return sendApiError(
        res,
        422,
        "CSV_FILE_REQUIRED",
        "Choose a CSV file to review"
      );
    }

    const result = await importStudentApprovals(
      db,
      req.file.buffer.toString("utf8"),
      req.user.id,
      { dryRun: req.query.dryRun }
    );

    if (!req.query.dryRun && !result.report.canImport) {
      return res.status(422).json({
        code: "CSV_IMPORT_INVALID",
        message: "Correct the reported CSV rows before importing",
        ...result,
      });
    }

    return res.status(req.query.dryRun ? 200 : 201).json({
      message: req.query.dryRun
        ? "CSV review completed"
        : "Student approvals imported",
      ...result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Import Approved Students Error"
    );
  }
};

export const reinstateStudentApproval = async (req, res) => {
  try {
    const result = await reinstateApprovedStudent(
      db,
      req.params.id,
      req.body,
      req.user.id
    );

    return res.json({
      message: "Student approval reinstated",
      ...result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Reinstate Student Approval Error"
    );
  }
};

export const revokeStudentApproval = async (req, res) => {
  try {
    const result = await revokeApprovedStudent(
      db,
      req.params.id,
      req.body,
      req.user.id
    );

    return res.json({
      message: "Student approval revoked",
      ...result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Revoke Student Approval Error"
    );
  }
};

export const reissueStudentActivationEmail = async (req, res) => {
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

    const result = await reissueApprovedStudentActivation(
      db,
      req.params.id,
      req.user.id
    );

    try {
      await sendStudentActivationEmail(emailConfig, result.delivery);
    } catch (deliveryError) {
      await revokeStudentActivationToken(db, result.delivery.tokenId);
      console.error(
        "Student activation email reissue failed:",
        deliveryError.message
      );

      return sendApiError(
        res,
        503,
        "ACTIVATION_EMAIL_DELIVERY_FAILED",
        "The activation email could not be delivered"
      );
    }

    return res.status(202).json({
      message: "Student activation email sent",
      approval: result.approval,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Reissue Student Activation Email Error"
    );
  }
};
