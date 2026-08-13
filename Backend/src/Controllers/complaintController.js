import { db } from "../db/index.js";
import { complaints, complaintTimelines, users } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";


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
    console.error("Create Complaint Error:", error);
    res.status(500).json({ message: "Create failed", error: error.message });
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
    console.error("Fetch My Complaints Error:", error);
    res.status(500).json({ message: "Fetch failed", error: error.message });
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
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Only owner or admin can delete
    if (complaint.userId !== Number(req.user.id) && req.user.role !== "admin") {
      return res.status(401).json({ message: "Not authorized" });
    }

    await db.delete(complaints).where(eq(complaints.id, complaintId));
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error("Delete Complaint Error:", error);
    res.status(500).json({ message: "Delete failed", error: error.message });
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
    console.error("All Complaints Error:", error);
    res.status(500).json({ message: "Fetch failed", error: error.message });
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
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Add timeline record
    await db.insert(complaintTimelines).values({
      complaintId,
      status,
      note: resolutionNote || `Admin updated status to ${status}`,
    });

    res.json({ message: "Status Updated", complaint: updatedComplaint });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "Update status failed", error: error.message });
  }
};

// ================= STUDENT VERIFY COMPLAINT =================
export const studentVerifyComplaint = async (req, res) => {
  try {
    const complaintId = Number(req.params.id);
    const { status, note } = req.body; // status should be "Closed" or "In Progress"
    const userId = Number(req.user.id);

    // Verify ownership
    const [complaint] = await db
      .select()
      .from(complaints)
      .where(eq(complaints.id, complaintId));

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (complaint.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized to verify this complaint" });
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
    console.error("Verify Complaint Error:", error);
    res.status(500).json({ message: "Verification failed", error: error.message });
  }
};
