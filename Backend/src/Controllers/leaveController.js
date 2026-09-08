import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { db } from "../db/index.js";
import { legacyLeaves as leaves, users } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import {
  handleControllerError,
  sendApiError,
} from "../utils/apiErrors.js";
import {
  createLeaveRequest,
  listStudentLeaveRequests,
} from "../services/leaveRequestService.js";
import { decideLeaveRequest } from "../services/leaveDecisionService.js";
import {
  getGatePass,
  readGatePassArtifact,
} from "../services/gatePassService.js";

// Normalized student leave submission. Legacy handlers below remain available
// until the leave frontend moves to the secure workflow.
export const createStudentLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await createLeaveRequest(db, req.user, req.body);
    return res.status(201).json({ leaveRequest });
  } catch (error) {
    return handleControllerError(res, error, "Create Leave Request Error");
  }
};

export const listMyStudentLeaveRequests = async (req, res) => {
  try {
    const result = await listStudentLeaveRequests(db, req.user, req.query);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "List Student Leave Requests Error");
  }
};

export const decideStudentLeaveRequest = async (req, res) => {
  try {
    const result = await decideLeaveRequest(
      db,
      req.user,
      req.params.id,
      req.body
    );
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "Decide Leave Request Error");
  }
};

export const getStudentGatePass = async (req, res) => {
  try {
    const gatePass = await getGatePass(db, req.user, req.params.id);
    return res.json({ gatePass });
  } catch (error) {
    return handleControllerError(res, error, "Get Gate Pass Error");
  }
};

const sendGatePassArtifact = async (req, res, kind) => {
  try {
    const artifact = await readGatePassArtifact(
      db,
      req.user,
      req.params.id,
      kind
    );
    const disposition = kind === "pdf" ? "attachment" : "inline";

    res.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${disposition}; filename="${artifact.filename}"`,
      "Content-Length": artifact.contents.length,
      "Content-Type": artifact.mimeType,
    });
    return res.send(artifact.contents);
  } catch (error) {
    return handleControllerError(res, error, "Read Gate Pass File Error");
  }
};

export const viewStudentGatePassQr = (req, res) =>
  sendGatePassArtifact(req, res, "qr");

export const downloadStudentGatePassPdf = (req, res) =>
  sendGatePassArtifact(req, res, "pdf");

// Ensure uploads folder exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Student Apply Leave
export const applyLeave = async (req, res) => {
  try {
    const studentId = Number(req.user.id);
    const { reason, fromDate, toDate } = req.body;

    const [newLeave] = await db
      .insert(leaves)
      .values({
        studentId,
        reason,
        fromDate,
        toDate,
        status: "Pending",
      })
      .returning();

    res.status(201).json({ ...newLeave, _id: newLeave.id });
  } catch (error) {
    return handleControllerError(res, error, "Apply Leave Error");
  }
};

// Admin View All Leaves
export const getAllLeaves = async (req, res) => {
  try {
    const results = await db
      .select({
        id: leaves.id,
        _id: leaves.id,
        reason: leaves.reason,
        fromDate: leaves.fromDate,
        toDate: leaves.toDate,
        status: leaves.status,
        passCode: leaves.passCode,
        adminSignature: leaves.adminSignature,
        pdfFile: leaves.pdfFile,
        leftAt: leaves.leftAt,
        returnedAt: leaves.returnedAt,
        createdAt: leaves.createdAt,
        student: {
          id: users.id,
          name: users.name,
          email: users.email,
          rollNo: users.rollNo,
          phone: users.phone,
          roomNo: users.roomNo,
        },
      })
      .from(leaves)
      .leftJoin(users, eq(leaves.studentId, users.id))
      .orderBy(desc(leaves.createdAt));

    res.json(results);
  } catch (error) {
    return handleControllerError(res, error, "Get All Leaves Error");
  }
};

// Admin Approve Leave (With Cryptographic Pass Code & QR Generation)
export const approveLeave = async (req, res) => {
  try {
    const leaveId = Number(req.params.id);

    const [leaveData] = await db
      .select({
        id: leaves.id,
        reason: leaves.reason,
        fromDate: leaves.fromDate,
        toDate: leaves.toDate,
        studentId: leaves.studentId,
        student: {
          name: users.name,
          email: users.email,
          rollNo: users.rollNo,
          roomNo: users.roomNo,
        },
      })
      .from(leaves)
      .leftJoin(users, eq(leaves.studentId, users.id))
      .where(eq(leaves.id, leaveId));

    if (!leaveData) {
      return sendApiError(res, 404, "LEAVE_NOT_FOUND", "Leave not found");
    }

    // Generate unique 6-character Pass Code (e.g. LP-4821)
    const passCode = `LP-${leaveData.id}${Math.floor(1000 + Math.random() * 9000)}`;
    const fileName = `leave_${leaveData.id}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    // Generate QR Code data URL
    const qrDataUrl = await QRCode.toDataURL(passCode, { width: 140, margin: 1 });
    const qrImageBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

    // Generate PDF Pass with QR Code
    const doc = new PDFDocument({ margin: 40 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text("HOSTEL MANAGEMENT SYSTEM", { align: "center" });
    doc.fontSize(14).font("Helvetica").text("OFFICIAL STUDENT GATE PASS", { align: "center" });
    doc.moveDown(1);
    doc.strokeColor("#cccccc").lineWidth(1).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown(1);

    // Pass details
    doc.fontSize(11).font("Helvetica-Bold").text(`GATE PASS CODE: ${passCode}`);
    doc.font("Helvetica").text(`Student Name: ${leaveData.student?.name || "Student"}`);
    doc.text(`Roll Number: ${leaveData.student?.rollNo || "N/A"}`);
    doc.text(`Room Number: ${leaveData.student?.roomNo || "N/A"}`);
    doc.moveDown(0.5);
    doc.text(`Valid From: ${leaveData.fromDate || "N/A"}`);
    doc.text(`Valid Until: ${leaveData.toDate || "N/A"}`);
    doc.text(`Reason: ${leaveData.reason || "N/A"}`);
    doc.moveDown(1);

    // Embed QR Code
    doc.image(qrImageBuffer, 400, 100, { width: 130 });
    doc.fontSize(9).text("Scan via Guard Terminal", 400, 235, { width: 130, align: "center" });

    doc.moveDown(2);
    doc.fontSize(10).font("Helvetica-Bold").text("SECURITY VERIFICATION NOTICE:");
    doc.fontSize(9).font("Helvetica").text(
      "This gate pass must be verified by the security guard at the hostel main gate upon exit and entry. Any tampering invalidates this pass."
    );
    doc.moveDown(1);
    doc.text("Status: ✔ DIGITALLY APPROVED BY WARDEN");
    doc.end();

    await new Promise((resolve) => writeStream.on("finish", resolve));

    const [updatedLeave] = await db
      .update(leaves)
      .set({
        status: "Approved",
        passCode: passCode,
        adminSignature: "SIGNED_BY_ADMIN",
        pdfFile: fileName,
      })
      .where(eq(leaves.id, leaveId))
      .returning();

    res.json({ message: "Approved with QR Pass", leave: updatedLeave, passCode });
  } catch (error) {
    return handleControllerError(res, error, "Approve Leave Error");
  }
};

// Student My Leaves
export const myLeaves = async (req, res) => {
  try {
    const studentId = Number(req.user.id);

    const userLeaves = await db
      .select()
      .from(leaves)
      .where(eq(leaves.studentId, studentId))
      .orderBy(desc(leaves.createdAt));

    const formatted = userLeaves.map((l) => ({ ...l, _id: l.id }));
    res.json(formatted);
  } catch (error) {
    return handleControllerError(res, error, "My Leaves Error");
  }
};

// Admin Reject Leave
export const rejectLeave = async (req, res) => {
  try {
    const leaveId = Number(req.params.id);

    const [updatedLeave] = await db
      .update(leaves)
      .set({
        status: "Rejected",
        adminSignature: "REJECTED_BY_ADMIN",
      })
      .where(eq(leaves.id, leaveId))
      .returning();

    if (!updatedLeave) {
      return sendApiError(res, 404, "LEAVE_NOT_FOUND", "Leave not found");
    }

    res.json({ message: "Rejected", leave: updatedLeave });
  } catch (error) {
    return handleControllerError(res, error, "Reject Leave Error");
  }
};
