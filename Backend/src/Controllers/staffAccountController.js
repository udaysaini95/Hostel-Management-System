import { db } from "../db/index.js";
import {
  acceptStaffInvitation,
  issueStaffInvitation,
  setManagedAccountStatus,
} from "../services/staffAccountService.js";
import {
  handleControllerError,
  sendApiError,
} from "../utils/apiErrors.js";

const sendStaffAccountError = (res, error, operation) => {
  if (error?.code === "23505") {
    return sendApiError(
      res,
      409,
      "ACCOUNT_OR_INVITATION_CONFLICT",
      "The account or invitation already exists"
    );
  }

  return handleControllerError(res, error, operation);
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
