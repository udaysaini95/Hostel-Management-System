import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { db } from "../db/index.js";

import { leaves, users } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

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

    res.json({ ...newLeave, _id: newLeave.id });
  } catch (error) {
    console.error("Apply Leave Error:", error);
    res.status(500).json({ message: "Failed to apply leave", error: error.message });
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
        adminSignature: leaves.adminSignature,
        pdfFile: leaves.pdfFile,
        createdAt: leaves.createdAt,
        student: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(leaves)
      .leftJoin(users, eq(leaves.studentId, users.id))
      .orderBy(desc(leaves.createdAt));

    res.json(results);
  } catch (error) {
    console.error("Get All Leaves Error:", error);
    res.status(500).json({ message: "Failed to fetch leaves", error: error.message });
  }
};

// Admin Approve Leave
export const approveLeave = async (req, res) => {
  try {
    const leaveId = Number(req.params.id);

    const [leave] = await db
      .select()
      .from(leaves)
      .where(eq(leaves.id, leaveId));

    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }

    const fileName = `leave_${leave.id}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    // Generate PDF
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(18).text("HOSTEL LEAVE PASS", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Leave Request ID: #${leave.id}`);
    doc.text(`Reason: ${leave.reason || "N/A"}`);
    doc.text(`From: ${leave.fromDate || "N/A"}`);
    doc.text(`To: ${leave.toDate || "N/A"}`);
    doc.moveDown();
    doc.text("Digitally Approved By Admin");
    doc.text("Signature: ✔ SIGNED_BY_ADMIN");
    doc.end();

    const [updatedLeave] = await db
      .update(leaves)
      .set({
        status: "Approved",
        adminSignature: "SIGNED_BY_ADMIN",
        pdfFile: fileName,
      })
      .where(eq(leaves.id, leaveId))
      .returning();

    res.json({ message: "Approved", leave: updatedLeave });
  } catch (error) {
    console.error("Approve Leave Error:", error);
    res.status(500).json({ message: "Failed to approve leave", error: error.message });
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
    console.error("My Leaves Error:", error);
    res.status(500).json({ message: "Failed to fetch leaves", error: error.message });
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
      return res.status(404).json({ message: "Leave not found" });
    }

    res.json({ message: "Rejected", leave: updatedLeave });
  } catch (error) {
    console.error("Reject Leave Error:", error);
    res.status(500).json({ message: "Failed to reject leave", error: error.message });
  }
};
