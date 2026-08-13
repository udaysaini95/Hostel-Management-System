import { db } from "../db/index.js";
import { leaves, users, gateLogs } from "../db/schema.js";
import { eq, or, desc, and } from "drizzle-orm";

// 1. Verify Pass or Roll Number (Guard Terminal)
export const verifyGatePass = async (req, res) => {
  try {
    const { identifier } = req.body; // passCode (e.g. LP-4821) OR Roll No OR Email

    if (!identifier) {
      return res.status(400).json({ message: "Please provide a Pass Code, QR Token, or Roll Number." });
    }

    const trimmed = identifier.trim();

    // Query leave and associated student
    const results = await db
      .select({
        leaveId: leaves.id,
        reason: leaves.reason,
        fromDate: leaves.fromDate,
        toDate: leaves.toDate,
        status: leaves.status,
        passCode: leaves.passCode,
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
      .where(
        or(
          eq(leaves.passCode, trimmed),
          eq(users.rollNo, trimmed),
          eq(users.email, trimmed)
        )
      )
      .orderBy(desc(leaves.createdAt));

    if (!results || results.length === 0) {
      return res.status(404).json({
        valid: false,
        message: "No leave records found for this Pass Code or Roll Number.",
      });
    }

    // Prioritize active leaves (Approved or Exited)
    const activeLeave = results.find((l) => l.status === "Approved" || l.status === "Exited") || results[0];

    const canExit = activeLeave.status === "Approved";
    const canEnter = activeLeave.status === "Exited";

    let stateMessage = "";
    if (activeLeave.status === "Approved") {
      stateMessage = "Pass is Approved and Valid. Ready for Gate Check-Out.";
    } else if (activeLeave.status === "Exited") {
      stateMessage = "Student is currently outside campus. Ready for Gate Check-In (Return).";
    } else if (activeLeave.status === "Returned") {
      stateMessage = "Pass has already been completed and returned.";
    } else if (activeLeave.status === "Pending") {
      stateMessage = "Leave application is still Pending Warden Approval.";
    } else if (activeLeave.status === "Rejected") {
      stateMessage = "Leave application was Rejected by Warden.";
    }

    res.json({
      valid: activeLeave.status === "Approved" || activeLeave.status === "Exited",
      canExit,
      canEnter,
      stateMessage,
      leave: activeLeave,
    });
  } catch (error) {
    console.error("Gate Verification Error:", error);
    res.status(500).json({ message: "Failed to verify gate pass", error: error.message });
  }
};

// 2. Log Gate Action (EXIT or ENTRY)
export const logGateAction = async (req, res) => {
  try {
    const { leaveId, action, remarks } = req.body;
    const guardId = req.user?.id ? Number(req.user.id) : null;

    if (!leaveId || !action || !["EXIT", "ENTRY"].includes(action)) {
      return res.status(400).json({ message: "Invalid leave ID or action (Must be EXIT or ENTRY)." });
    }

    const [leave] = await db
      .select()
      .from(leaves)
      .where(eq(leaves.id, Number(leaveId)));

    if (!leave) {
      return res.status(404).json({ message: "Leave record not found." });
    }

    const now = new Date();

    // Insert into gate logs
    await db.insert(gateLogs).values({
      leaveId: leave.id,
      studentId: leave.studentId,
      guardId: guardId,
      action: action,
      scannedAt: now,
      remarks: remarks || null,
    });

    // Update leave state machine
    if (action === "EXIT") {
      await db
        .update(leaves)
        .set({
          status: "Exited",
          leftAt: now,
        })
        .where(eq(leaves.id, leave.id));
    } else if (action === "ENTRY") {
      await db
        .update(leaves)
        .set({
          status: "Returned",
          returnedAt: now,
        })
        .where(eq(leaves.id, leave.id));
    }

    res.json({
      message: `Gate ${action === "EXIT" ? "Departure" : "Arrival"} logged successfully at ${now.toLocaleTimeString()}`,
      action,
      timestamp: now,
    });
  } catch (error) {
    console.error("Log Gate Action Error:", error);
    res.status(500).json({ message: "Failed to log gate action", error: error.message });
  }
};

// 3. Get Real-Time List of Students Outside Campus (For Warden & Guard Live Dashboard)
export const getActiveOutsideStudents = async (req, res) => {
  try {
    const results = await db
      .select({
        leaveId: leaves.id,
        reason: leaves.reason,
        fromDate: leaves.fromDate,
        toDate: leaves.toDate,
        passCode: leaves.passCode,
        leftAt: leaves.leftAt,
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
      .where(eq(leaves.status, "Exited"))
      .orderBy(desc(leaves.leftAt));

    res.json(results);
  } catch (error) {
    console.error("Get Outside Students Error:", error);
    res.status(500).json({ message: "Failed to fetch outside students", error: error.message });
  }
};

// 4. Get Recent Gate Activity Logs
export const getRecentGateLogs = async (req, res) => {
  try {
    const logs = await db
      .select({
        id: gateLogs.id,
        action: gateLogs.action,
        scannedAt: gateLogs.scannedAt,
        remarks: gateLogs.remarks,
        student: {
          name: users.name,
          rollNo: users.rollNo,
          roomNo: users.roomNo,
        },
      })
      .from(gateLogs)
      .leftJoin(users, eq(gateLogs.studentId, users.id))
      .orderBy(desc(gateLogs.scannedAt))
      .limit(30);

    res.json(logs);
  } catch (error) {
    console.error("Get Gate Logs Error:", error);
    res.status(500).json({ message: "Failed to fetch gate logs", error: error.message });
  }
};
