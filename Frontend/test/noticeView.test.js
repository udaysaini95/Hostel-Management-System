import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildNoticePayload,
  getAudienceLabel,
  NOTICE_AUDIENCES,
  validateNoticeForm,
} from "../src/notices/noticeView.js";
import { groupNotifications } from "../src/notifications/notificationView.js";

const noticeStylesPath = fileURLToPath(
  new URL("../src/styles/notices.css", import.meta.url)
);

test("notice audience labels preserve hostel context", () => {
  assert.equal(getAudienceLabel({ type: NOTICE_AUDIENCES.ALL_RESIDENTS }), "All residents");
  assert.equal(
    getAudienceLabel({
      type: NOTICE_AUDIENCES.HOSTEL,
      hostel: { code: "H1", name: "North Hall" },
    }),
    "North Hall"
  );
});

test("notice payload includes only fields required by the selected audience", () => {
  const payload = buildNoticePayload({
    title: "  Water supply  ",
    body: "  Supply resumes at 6 PM.  ",
    priority: "important",
    audienceType: NOTICE_AUDIENCES.HOSTEL,
    role: "student",
    hostelId: "2",
    expiresAt: "",
  });

  assert.deepEqual(payload, {
    title: "Water supply",
    body: "Supply resumes at 6 PM.",
    priority: "important",
    audience: { type: "hostel", hostelId: 2 },
    expiresAt: undefined,
  });
});

test("notice validation requires the location selected by its audience", () => {
  const errors = validateNoticeForm({
    title: "Water supply",
    body: "Supply resumes at 6 PM.",
    audienceType: NOTICE_AUDIENCES.HOSTEL,
    hostelId: "",
    expiresAt: "",
  });

  assert.equal(errors.hostelId, "Select a hostel.");
});

test("notification center groups the last seven days separately", () => {
  const groups = groupNotifications(
    [
      { id: 1, createdAt: "2026-09-09T12:00:00.000Z" },
      { id: 2, createdAt: "2026-08-30T12:00:00.000Z" },
    ],
    new Date("2026-09-10T12:00:00.000Z")
  );

  assert.deepEqual(groups.recent.map(({ id }) => id), [1]);
  assert.deepEqual(groups.earlier.map(({ id }) => id), [2]);
});

test("notices retain explicit unread and mobile presentation rules", async () => {
  const styles = await readFile(noticeStylesPath, "utf8");

  assert.match(styles, /\.hm-notice-card--unread/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /\.hm-notification-panel\s*{[\s\S]*?position: fixed/);
  assert.doesNotMatch(styles, /linear-gradient/);
});
