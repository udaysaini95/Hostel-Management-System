import { db } from "../db/index.js";
import {
  acceptStaffInvitation,
  issueStaffInvitation,
  setManagedAccountStatus,
  StaffAccountError,
} from "../services/staffAccountService.js";

const sendStaffAccountError = (res, error, operation) => {
  if (error instanceof StaffAccountError) {
    return res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
    });
  }

  if (error?.code === "23505") {
    return res.status(409).json({
      code: "ACCOUNT_OR_INVITATION_CONFLICT",
      message: "The account or invitation already exists",
    });
  }

  console.error(`${operation}:`, error);
  return res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "The request could not be completed",
  });
};

export const createStaffInvitation = async (req, res) => {
  try {
    const result = await issueStaffInvitation(db, req.body, req.user.id);

    return res.status(201).json({
      message: "Staff invitation created",
      ...result,
    });
  } catch (error) {
    return sendStaffAccountError(res, error, "Create Staff Invitation Error");
  }
};

export const acceptStaffInvitationRequest = async (req, res) => {
  try {
    const result = await acceptStaffInvitation(db, req.body);

    return res.status(201).json({
      message: "Staff account activated",
      ...result,
    });
  } catch (error) {
    return sendStaffAccountError(res, error, "Accept Staff Invitation Error");
  }
};

export const updateAccountStatus = async (req, res) => {
  try {
    const result = await setManagedAccountStatus(db, {
      actorId: req.user.id,
      targetUserId: req.params.id,
      status: req.body?.status,
    });

    return res.json({
      message: "Account status updated",
      ...result,
    });
  } catch (error) {
    return sendStaffAccountError(res, error, "Update Account Status Error");
  }
};
