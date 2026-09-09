import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../drizzle/0017_validated_mess_feedback.sql", import.meta.url);

test("mess feedback migration adds scoped immutable meal ratings", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /RENAME TO "legacy_mess_feedbacks"/);
  assert.match(migration, /"rating" integer NOT NULL/);
  assert.match(migration, /mess_feedbacks_rating_check/);
  assert.match(migration, /mess_feedbacks_student_menu_meal_unique/);
  assert.match(migration, /mess_feedback_scope_guard/);
  assert.match(migration, /Feedback revision is outside the selected menu/);
  assert.match(migration, /Mess feedback is immutable/);
});
