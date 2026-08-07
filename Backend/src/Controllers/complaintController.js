import { db } from "../db/index.js";
import { complaints, complaintTimelines, users } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";


// ================= CREATE COMPLAINT =================
export const createComplaint = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const { type, room, description } = req.body;

    const [complaint] = await db
      .insert(complaints)
      .values({
        userId,
        type,
        room,
        description,
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
    const { status } = req.body;

    const [updatedComplaint] = await db
      .update(complaints)
      .set({ status, updatedAt: new Date() })
      .where(eq(complaints.id, complaintId))
      .returning();

    if (!updatedComplaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Add timeline record
    await db.insert(complaintTimelines).values({
      complaintId,
      status,
    });

    res.json({ message: "Status Updated", complaint: updatedComplaint });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "Update status failed", error: error.message });
  }
};
