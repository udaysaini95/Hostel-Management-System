import test from "node:test";
import assert from "node:assert/strict";
import {
  notificationListSchema,
  notificationResourceSchema,
} from "../src/validation/notificationSchemas.js";

test("notification list validation has bounded defaults", () => {
  assert.deepEqual(notificationListSchema.query.parse({}), {
    page: 1,
    pageSize: 20,
    readState: "all",
  });
  assert.equal(notificationListSchema.query.parse({ readState: "unread" }).readState, "unread");
  assert.throws(() => notificationListSchema.query.parse({ pageSize: 51 }));
  assert.throws(() => notificationListSchema.query.parse({ readState: "archived" }));
});

test("notification resource IDs are normalized", () => {
  assert.deepEqual(notificationResourceSchema.params.parse({ id: "17" }), { id: 17 });
  assert.throws(() => notificationResourceSchema.params.parse({ id: "0" }));
});
