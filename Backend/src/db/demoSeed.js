import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import { USER_ROLES } from "../domain/roles.js";
import { hostelMemberships, hostels, users } from "./schema.js";

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

export const DEMO_USERS = Object.freeze([
  Object.freeze({
    name: "Mira Sen",
    email: "admin@hostelmate.example",
    role: USER_ROLES.ADMIN,
    hostelCodes: Object.freeze([]),
    primaryHostelCode: null,
  }),
  Object.freeze({
    name: "Neha Kapoor",
    email: "warden.h1@hostelmate.example",
    role: USER_ROLES.WARDEN,
    hostelCodes: Object.freeze(["H1"]),
    primaryHostelCode: "H1",
  }),
  Object.freeze({
    name: "Arjun Das",
    email: "maintenance@hostelmate.example",
    role: USER_ROLES.MAINTENANCE,
    hostelCodes: Object.freeze(["H1", "H2"]),
    primaryHostelCode: "H1",
  }),
  Object.freeze({
    name: "Rohan Iyer",
    email: "guard.h2@hostelmate.example",
    role: USER_ROLES.GUARD,
    hostelCodes: Object.freeze(["H2"]),
    primaryHostelCode: "H2",
  }),
  Object.freeze({
    name: "Kavya Nair",
    email: "student.h1@hostelmate.example",
    role: USER_ROLES.STUDENT,
    rollNo: "DEMO-H1-001",
    phone: "0000000001",
    roomNo: "A-101",
    hostelCodes: Object.freeze(["H1"]),
    primaryHostelCode: "H1",
  }),
  Object.freeze({
    name: "Dev Patel",
    email: "student.h2@hostelmate.example",
    role: USER_ROLES.STUDENT,
    rollNo: "DEMO-H2-001",
    phone: "0000000002",
    roomNo: "B-204",
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

  if (!environment.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed demo data.");
  }
};

export const resetDemoData = async (database) => {
  await database.delete(users).where(
    inArray(
      users.email,
      DEMO_USERS.map((user) => user.email)
    )
  );

  await database.delete(hostels).where(
    inArray(
      hostels.code,
      DEMO_HOSTELS.map((hostel) => hostel.code)
    )
  );
};

export const seedDemoData = async (database, password) => {
  if (!password || password.length < 12) {
    throw new Error("DEMO_SEED_PASSWORD must contain at least 12 characters.");
  }

  const now = new Date();
  const verifiedAt = new Date(DEMO_EMAIL_VERIFIED_AT);
  const passwordHash = await bcrypt.hash(password, 10);
  const hostelIds = new Map();

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
  }

  return {
    hostels: DEMO_HOSTELS.length,
    users: DEMO_USERS.length,
    memberships: DEMO_USERS.reduce(
      (total, user) => total + user.hostelCodes.length,
      0
    ),
  };
};
