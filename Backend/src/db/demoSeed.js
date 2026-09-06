import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireDatabaseUrl } from "../config/runtimeConfig.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import { USER_ROLES } from "../domain/roles.js";
import {
  hostelBlocks,
  hostelMemberships,
  hostels,
  roomAllocations,
  rooms,
  staffProfiles,
  studentProfiles,
  users,
} from "./schema.js";

export const DEMO_EMAIL_VERIFIED_AT = "2026-01-01T00:00:00.000Z";

export const DEMO_HOSTELS = Object.freeze([
  Object.freeze({
    code: "H1",
    name: "North Residence Hall",
    address: "Demo Campus, North Zone",
  }),
  Object.freeze({
    code: "H2",
    name: "South Residence Hall",
    address: "Demo Campus, South Zone",
  }),
]);

export const DEMO_BLOCKS = Object.freeze([
  Object.freeze({ hostelCode: "H1", code: "A", name: "Ashoka Block" }),
  Object.freeze({ hostelCode: "H2", code: "B", name: "Banyan Block" }),
]);

export const DEMO_ROOMS = Object.freeze([
  Object.freeze({
    hostelCode: "H1",
    blockCode: "A",
    roomNumber: "101",
    floor: 1,
    capacity: 2,
  }),
  Object.freeze({
    hostelCode: "H1",
    blockCode: "A",
    roomNumber: "102",
    floor: 1,
    capacity: 2,
  }),
  Object.freeze({
    hostelCode: "H2",
    blockCode: "B",
    roomNumber: "204",
    floor: 2,
    capacity: 2,
  }),
]);

export const DEMO_USERS = Object.freeze([
  Object.freeze({
    name: "Mira Sen",
    email: "admin@hostelmate.example",
    role: USER_ROLES.ADMIN,
    employeeNo: "DEMO-ADM-001",
    phone: "0000000100",
    jobTitle: "Hostel Administrator",
    hostelCodes: Object.freeze([]),
    primaryHostelCode: null,
  }),
  Object.freeze({
    name: "Neha Kapoor",
    email: "warden.h1@hostelmate.example",
    role: USER_ROLES.WARDEN,
    employeeNo: "DEMO-WDN-001",
    phone: "0000000101",
    jobTitle: "Resident Warden",
    hostelCodes: Object.freeze(["H1"]),
    primaryHostelCode: "H1",
  }),
  Object.freeze({
    name: "Arjun Das",
    email: "maintenance@hostelmate.example",
    role: USER_ROLES.MAINTENANCE,
    employeeNo: "DEMO-MNT-001",
    phone: "0000000102",
    jobTitle: "Maintenance Technician",
    hostelCodes: Object.freeze(["H1", "H2"]),
    primaryHostelCode: "H1",
  }),
  Object.freeze({
    name: "Rohan Iyer",
    email: "guard.h2@hostelmate.example",
    role: USER_ROLES.GUARD,
    employeeNo: "DEMO-GRD-001",
    phone: "0000000103",
    jobTitle: "Security Guard",
    hostelCodes: Object.freeze(["H2"]),
    primaryHostelCode: "H2",
  }),
  Object.freeze({
    name: "Kavya Nair",
    email: "student.h1@hostelmate.example",
    role: USER_ROLES.STUDENT,
    rollNo: "DEMO-H1-001",
    phone: "0000000001",
    guardianName: "Anita Nair",
    guardianPhone: "0000000201",
    roomNo: "A-101",
    room: Object.freeze({ blockCode: "A", roomNumber: "101" }),
    hostelCodes: Object.freeze(["H1"]),
    primaryHostelCode: "H1",
  }),
  Object.freeze({
    name: "Dev Patel",
    email: "student.h2@hostelmate.example",
    role: USER_ROLES.STUDENT,
    rollNo: "DEMO-H2-001",
    phone: "0000000002",
    guardianName: "Meera Patel",
    guardianPhone: "0000000202",
    roomNo: "B-204",
    room: Object.freeze({ blockCode: "B", roomNumber: "204" }),
    hostelCodes: Object.freeze(["H2"]),
    primaryHostelCode: "H2",
  }),
]);

export const assertDemoSeedAllowed = (environment) => {
  if (environment.NODE_ENV === "production") {
    throw new Error("Demo seed data is disabled in production.");
  }

  if (environment.ALLOW_DEMO_SEED !== "true") {
    throw new Error(
      "Set ALLOW_DEMO_SEED=true to confirm this database may receive demo data."
    );
  }

  requireDatabaseUrl(environment);

  if (
    !environment.DEMO_SEED_PASSWORD ||
    environment.DEMO_SEED_PASSWORD.length < 12
  ) {
    throw new Error("DEMO_SEED_PASSWORD must contain at least 12 characters.");
  }
};

export const resetDemoData = async (database) => {
  const demoUsers = await database
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, DEMO_USERS.map((user) => user.email)));
  const demoUserIds = demoUsers.map((user) => user.id);

  if (demoUserIds.length > 0) {
    const demoStudents = await database
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(inArray(studentProfiles.userId, demoUserIds));
    const demoStudentIds = demoStudents.map((student) => student.id);

    if (demoStudentIds.length > 0) {
      await database
        .delete(roomAllocations)
        .where(inArray(roomAllocations.studentProfileId, demoStudentIds));
    }

    await database
      .delete(studentProfiles)
      .where(inArray(studentProfiles.userId, demoUserIds));
    await database
      .delete(staffProfiles)
      .where(inArray(staffProfiles.userId, demoUserIds));
    await database.delete(users).where(inArray(users.id, demoUserIds));
  }

  const demoHostels = await database
    .select({ id: hostels.id })
    .from(hostels)
    .where(inArray(hostels.code, DEMO_HOSTELS.map((hostel) => hostel.code)));
  const demoHostelIds = demoHostels.map((hostel) => hostel.id);

  if (demoHostelIds.length > 0) {
    const demoBlocks = await database
      .select({ id: hostelBlocks.id })
      .from(hostelBlocks)
      .where(inArray(hostelBlocks.hostelId, demoHostelIds));
    const demoBlockIds = demoBlocks.map((block) => block.id);

    if (demoBlockIds.length > 0) {
      await database.delete(rooms).where(inArray(rooms.blockId, demoBlockIds));
      await database
        .delete(hostelBlocks)
        .where(inArray(hostelBlocks.id, demoBlockIds));
    }

    await database.delete(hostels).where(inArray(hostels.id, demoHostelIds));
  }
};

export const seedDemoData = async (database, password) => {
  if (!password || password.length < 12) {
    throw new Error("DEMO_SEED_PASSWORD must contain at least 12 characters.");
  }

  const now = new Date();
  const verifiedAt = new Date(DEMO_EMAIL_VERIFIED_AT);
  const passwordHash = await bcrypt.hash(password, 10);
  const hostelIds = new Map();
  const blockIds = new Map();
  const roomIds = new Map();
  const userIds = new Map();
  const studentProfileIds = new Map();

  for (const hostel of DEMO_HOSTELS) {
    const [savedHostel] = await database
      .insert(hostels)
      .values({ ...hostel, isActive: true, updatedAt: now })
      .onConflictDoUpdate({
        target: hostels.code,
        set: {
          name: hostel.name,
          address: hostel.address,
          isActive: true,
          updatedAt: now,
        },
      })
      .returning({ id: hostels.id, code: hostels.code });

    hostelIds.set(savedHostel.code, savedHostel.id);
  }

  for (const block of DEMO_BLOCKS) {
    const hostelId = hostelIds.get(block.hostelCode);

    if (!hostelId) {
      throw new Error(`Unknown demo hostel code: ${block.hostelCode}`);
    }

    const [savedBlock] = await database
      .insert(hostelBlocks)
      .values({
        hostelId,
        code: block.code,
        name: block.name,
        isActive: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [hostelBlocks.hostelId, hostelBlocks.code],
        set: { name: block.name, isActive: true, updatedAt: now },
      })
      .returning({ id: hostelBlocks.id });

    blockIds.set(`${block.hostelCode}:${block.code}`, savedBlock.id);
  }

  for (const room of DEMO_ROOMS) {
    const blockId = blockIds.get(`${room.hostelCode}:${room.blockCode}`);

    if (!blockId) {
      throw new Error(
        `Unknown demo block: ${room.hostelCode}/${room.blockCode}`
      );
    }

    const [savedRoom] = await database
      .insert(rooms)
      .values({
        blockId,
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
        isActive: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [rooms.blockId, rooms.roomNumber],
        set: {
          floor: room.floor,
          capacity: room.capacity,
          isActive: true,
          updatedAt: now,
        },
      })
      .returning({ id: rooms.id });

    roomIds.set(
      `${room.hostelCode}:${room.blockCode}:${room.roomNumber}`,
      savedRoom.id
    );
  }

  for (const user of DEMO_USERS) {
    const [savedUser] = await database
      .insert(users)
      .values({
        name: user.name,
        email: user.email,
        password: passwordHash,
        role: user.role,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerifiedAt: verifiedAt,
        rollNo: user.rollNo ?? null,
        phone: user.phone ?? null,
        roomNo: user.roomNo ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: user.name,
          password: passwordHash,
          role: user.role,
          accountStatus: ACCOUNT_STATUSES.ACTIVE,
          emailVerifiedAt: verifiedAt,
          rollNo: user.rollNo ?? null,
          phone: user.phone ?? null,
          roomNo: user.roomNo ?? null,
          updatedAt: now,
        },
      })
      .returning({ id: users.id });

    userIds.set(user.email, savedUser.id);

    await database
      .update(hostelMemberships)
      .set({ isPrimary: false })
      .where(eq(hostelMemberships.userId, savedUser.id));

    for (const hostelCode of user.hostelCodes) {
      const hostelId = hostelIds.get(hostelCode);

      if (!hostelId) {
        throw new Error(`Unknown demo hostel code: ${hostelCode}`);
      }

      await database
        .insert(hostelMemberships)
        .values({
          userId: savedUser.id,
          hostelId,
          isPrimary: hostelCode === user.primaryHostelCode,
        })
        .onConflictDoUpdate({
          target: [hostelMemberships.userId, hostelMemberships.hostelId],
          set: { isPrimary: hostelCode === user.primaryHostelCode },
        });
    }

    if (user.role === USER_ROLES.STUDENT) {
      const hostelId = hostelIds.get(user.primaryHostelCode);
      const [savedProfile] = await database
        .insert(studentProfiles)
        .values({
          userId: savedUser.id,
          hostelId,
          rollNo: user.rollNo,
          phone: user.phone,
          guardianName: user.guardianName,
          guardianPhone: user.guardianPhone,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: studentProfiles.userId,
          set: {
            hostelId,
            rollNo: user.rollNo,
            phone: user.phone,
            guardianName: user.guardianName,
            guardianPhone: user.guardianPhone,
            updatedAt: now,
          },
        })
        .returning({ id: studentProfiles.id });

      studentProfileIds.set(user.email, savedProfile.id);
      continue;
    }

    await database
      .insert(staffProfiles)
      .values({
        userId: savedUser.id,
        employeeNo: user.employeeNo,
        phone: user.phone,
        jobTitle: user.jobTitle,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: staffProfiles.userId,
        set: {
          employeeNo: user.employeeNo,
          phone: user.phone,
          jobTitle: user.jobTitle,
          updatedAt: now,
        },
      });
  }

  const allocationActorId = userIds.get("admin@hostelmate.example");

  for (const user of DEMO_USERS.filter((entry) => entry.room)) {
    const studentProfileId = studentProfileIds.get(user.email);
    const roomId = roomIds.get(
      `${user.primaryHostelCode}:${user.room.blockCode}:${user.room.roomNumber}`
    );

    if (!studentProfileId || !roomId || !allocationActorId) {
      throw new Error(`Incomplete demo room allocation for ${user.email}`);
    }

    const [currentAllocation] = await database
      .select({ id: roomAllocations.id })
      .from(roomAllocations)
      .where(
        and(
          eq(roomAllocations.studentProfileId, studentProfileId),
          isNull(roomAllocations.vacatedAt)
        )
      )
      .limit(1);

    if (!currentAllocation) {
      await database.insert(roomAllocations).values({
        studentProfileId,
        roomId,
        allocatedByUserId: allocationActorId,
        allocatedAt: verifiedAt,
        createdAt: verifiedAt,
      });
    }
  }

  return {
    hostels: DEMO_HOSTELS.length,
    blocks: DEMO_BLOCKS.length,
    rooms: DEMO_ROOMS.length,
    users: DEMO_USERS.length,
    profiles: DEMO_USERS.length,
    allocations: DEMO_USERS.filter((user) => user.room).length,
    memberships: DEMO_USERS.reduce(
      (total, user) => total + user.hostelCodes.length,
      0
    ),
  };
};
