import { db } from "../db/index.js";
import {
  legacyComplaints as complaints,
  legacyComplaintTimelines as complaintTimelines,
  users,
} from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import {
  canAccessOwnedResource,
  PERMISSIONS,
} from "../domain/permissions.js";
import {
  handleControllerError,
  sendApiError,
} from "../utils/apiErrors.js";
import {
  createComplaint as createNormalizedComplaint,
  getComplaintById,
  listComplaintCategories as getComplaintCategories,
  searchAssignedComplaints,
  searchManagedComplaints,
  searchOwnComplaints,
} from "../services/complaintService.js";
import {
  deleteComplaintAttachment as removeComplaintAttachment,
  downloadComplaintAttachment as readComplaintAttachment,
  listComplaintAttachments as getComplaintAttachments,
  uploadComplaintAttachment as saveComplaintAttachment,
} from "../services/complaintAttachmentService.js";
import {
  assignComplaint,
  listMaintenanceAssignees as getMaintenanceAssignees,
} from "../services/complaintAssignmentService.js";
import {
  resolveComplaint,
  startComplaintWork,
  verifyComplaintResolution,
} from "../services/complaintResolutionService.js";

const getContentDisposition = (filename) => {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

export const createMaintenanceComplaint = async (req, res) => {
  try {
    const complaint = await createNormalizedComplaint(
      db,
      req.user,
      req.body
    );

    return res.status(201).json({ complaint });
  } catch (error) {
    return handleControllerError(res, error, "Create Complaint Error");
  }
};

export const listOwnComplaints = async (req, res) => {
  try {
    const result = await searchOwnComplaints(db, req.user, req.query);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "List Own Complaints Error");
  }
};

export const listManagedComplaints = async (req, res) => {
  try {
    const result = await searchManagedComplaints(db, req.user, req.query);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "List Managed Complaints Error");
  }
};

export const listMaintenanceWorkQueue = async (req, res) => {
  try {
    const result = await searchAssignedComplaints(db, req.user, req.query);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "List Maintenance Work Error");
  }
};

export const listComplaintAssignees = async (req, res) => {
  try {
    const result = await getMaintenanceAssignees(db, req.user, req.query);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "List Complaint Assignees Error");
  }
};

export const assignMaintenanceComplaint = async (req, res) => {
  try {
    const result = await assignComplaint(
      db,
      req.user,
      req.params.id,
      req.body
    );

    return res.status(201).json(result);
  } catch (error) {
    return handleControllerError(res, error, "Assign Complaint Error");
  }
};

export const startMaintenanceComplaint = async (req, res) => {
  try {
    const complaint = await startComplaintWork(
      db,
      req.user,
      req.params.id
    );

    return res.json({ complaint });
  } catch (error) {
    return handleControllerError(res, error, "Start Complaint Work Error");
  }
};

export const resolveMaintenanceComplaint = async (req, res) => {
  try {
    const result = await resolveComplaint(
      db,
      req.user,
      req.params.id,
      req.body,
      req.file
    );

    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "Resolve Complaint Error");
  }
};

export const verifyMaintenanceComplaint = async (req, res) => {
  try {
    const complaint = await verifyComplaintResolution(
      db,
      req.user,
      req.params.id,
      req.body
    );

    return res.json({ complaint });
  } catch (error) {
    return handleControllerError(res, error, "Verify Complaint Resolution Error");
  }
};

export const getComplaintDetails = async (req, res) => {
  try {
    const complaint = await getComplaintById(db, req.user, req.params.id);
    return res.json({ complaint });
  } catch (error) {
    return handleControllerError(res, error, "Get Complaint Details Error");
  }
};

export const listComplaintCategories = async (req, res) => {
  try {
    const categories = await getComplaintCategories(db, req.user);
    return res.json({ data: categories });
  } catch (error) {
    return handleControllerError(res, error, "List Complaint Categories Error");
  }
};

export const uploadComplaintAttachment = async (req, res) => {
  try {
    const attachment = await saveComplaintAttachment(
      db,
      req.user,
      req.params.id,
      req.file
    );

    return res.status(201).json({ attachment });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Upload Complaint Attachment Error"
    );
  }
};

export const listComplaintAttachments = async (req, res) => {
  try {
    const attachments = await getComplaintAttachments(
      db,
      req.user,
      req.params.id
    );

    return res.json({ data: attachments });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "List Complaint Attachments Error"
    );
  }
};

export const downloadComplaintAttachment = async (req, res) => {
  try {
    const attachment = await readComplaintAttachment(
      db,
      req.user,
      req.params.id,
      req.params.attachmentId
    );

    res.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": getContentDisposition(attachment.originalName),
      "Content-Length": String(attachment.contents.length),
      "Content-Type": attachment.mimeType,
      "X-Content-Type-Options": "nosniff",
    });
    return res.send(attachment.contents);
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Download Complaint Attachment Error"
    );
  }
};

export const deleteComplaintAttachment = async (req, res) => {
  try {
    const attachment = await removeComplaintAttachment(
      db,
      req.user,
      req.params.id,
      req.params.attachmentId
    );

    return res.json({
      message: "Complaint attachment deleted",
      attachment,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Delete Complaint Attachment Error"
    );
  }
};

// ================= CREATE COMPLAINT =================
export const createComplaint = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const { type, room, description, priority = "P2 - Medium" } = req.body;

    // Calculate SLA Deadline
    const slaDeadline = new Date();
    if (priority.startsWith("P0")) slaDeadline.setHours(slaDeadline.getHours() + 2);
    else if (priority.startsWith("P1")) slaDeadline.setHours(slaDeadline.getHours() + 12);
    else if (priority.startsWith("P2")) slaDeadline.setHours(slaDeadline.getHours() + 48);
    else if (priority.startsWith("P3")) slaDeadline.setDate(slaDeadline.getDate() + 7);
    else slaDeadline.setHours(slaDeadline.getHours() + 48);

    const [complaint] = await db
      .insert(complaints)
      .values({
        userId,
        type,
        room,
        description,
        priority,
        slaDeadline,
        image: req.file ? req.file.filename : null,
        status: "Created",
      })
      .returning();

    // Insert timeline entry
    await db.insert(complaintTimelines).values({
      complaintId: complaint.id,
      status: "Created",
    });

    res.status(201).json({ ...complaint, _id: complaint.id });
  } catch (error) {
    return handleControllerError(res, error, "Create Complaint Error");
  }
};

// ================= MY COMPLAINTS =================
export const myComplaints = async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const userComplaints = await db
      .select()
      .from(complaints)
      .where(eq(complaints.userId, userId))
      .orderBy(desc(complaints.createdAt));

    // Map _id for frontend backwards compatibility
    const formatted = userComplaints.map((c) => ({ ...c, _id: c.id }));
    res.json(formatted);
  } catch (error) {
    return handleControllerError(res, error, "Fetch My Complaints Error");
  }
};

// ================= DELETE COMPLAINT =================
export const deleteComplaint = async (req, res) => {
  try {
    const complaintId = Number(req.params.id);

    const [complaint] = await db
      .select()
      .from(complaints)
      .where(eq(complaints.id, complaintId));

    if (!complaint) {
      return sendApiError(
        res,
        404,
        "COMPLAINT_NOT_FOUND",
        "Complaint not found"
      );
    }

    if (
      !canAccessOwnedResource({
        actor: req.user,
        ownerId: complaint.userId,
        ownPermission: PERMISSIONS.COMPLAINT_DELETE_OWN,
        anyPermission: PERMISSIONS.COMPLAINT_DELETE_ANY,
      })
    ) {
      return sendApiError(
        res,
        403,
        "RESOURCE_ACCESS_DENIED",
        "You cannot delete this complaint"
      );
    }

    await db.delete(complaints).where(eq(complaints.id, complaintId));
    res.json({ message: "Deleted" });
  } catch (error) {
    return handleControllerError(res, error, "Delete Complaint Error");
  }
};

// ================= ADMIN: ALL COMPLAINTS =================
export const allComplaints = async (req, res) => {
  try {
    const results = await db
      .select({
        id: complaints.id,
        _id: complaints.id,
        type: complaints.type,
        room: complaints.room,
        description: complaints.description,
        priority: complaints.priority,
        slaDeadline: complaints.slaDeadline,
        resolutionNote: complaints.resolutionNote,
        image: complaints.image,
        status: complaints.status,
        createdAt: complaints.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(complaints)
      .leftJoin(users, eq(complaints.userId, users.id))
      .orderBy(desc(complaints.createdAt));

    res.json(results);
  } catch (error) {
    return handleControllerError(res, error, "All Complaints Error");
  }
};

// ================= UPDATE COMPLAINT STATUS =================
export const updateStatus = async (req, res) => {
  try {
    const complaintId = Number(req.params.id);
    const { status, resolutionNote } = req.body;

    const [updatedComplaint] = await db
      .update(complaints)
      .set({ 
        status, 
        resolutionNote: resolutionNote || null,
        updatedAt: new Date() 
      })
      .where(eq(complaints.id, complaintId))
      .returning();

    if (!updatedComplaint) {
      return sendApiError(
        res,
        404,
        "COMPLAINT_NOT_FOUND",
        "Complaint not found"
      );
    }

    // Add timeline record
    await db.insert(complaintTimelines).values({
      complaintId,
      status,
      note: resolutionNote || `Admin updated status to ${status}`,
    });

    res.json({ message: "Status Updated", complaint: updatedComplaint });
  } catch (error) {
    return handleControllerError(res, error, "Update Complaint Status Error");
  }
};

// ================= STUDENT VERIFY COMPLAINT =================
export const studentVerifyComplaint = async (req, res) => {
  try {
    const complaintId = Number(req.params.id);
    const { status, note } = req.body; // status should be "Closed" or "In Progress"

    // Verify ownership
    const [complaint] = await db
      .select()
      .from(complaints)
      .where(eq(complaints.id, complaintId));

    if (!complaint) {
      return sendApiError(
        res,
        404,
        "COMPLAINT_NOT_FOUND",
        "Complaint not found"
      );
    }

    if (
      !canAccessOwnedResource({
        actor: req.user,
        ownerId: complaint.userId,
        ownPermission: PERMISSIONS.COMPLAINT_VERIFY_OWN,
        anyPermission: PERMISSIONS.COMPLAINT_VERIFY_ANY,
      })
    ) {
      return sendApiError(
        res,
        403,
        "RESOURCE_ACCESS_DENIED",
        "You cannot verify this complaint"
      );
    }

    const updateData = { status, updatedAt: new Date() };
    if (status === "Created" && note) {
      updateData.resolutionNote = `[Reopened by Student]: ${note}`;
    }

    const [updatedComplaint] = await db
      .update(complaints)
      .set(updateData)
      .where(eq(complaints.id, complaintId))
      .returning();

    await db.insert(complaintTimelines).values({
      complaintId,
      status,
      note: note || `Student verified and marked as ${status}`,
    });

    res.json({ message: "Verification logged", complaint: updatedComplaint });
  } catch (error) {
    return handleControllerError(res, error, "Verify Complaint Error");
  }
};
