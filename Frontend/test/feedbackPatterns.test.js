import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getApiErrorMessage } from "../src/api/errors.js";

const sourceDirectory = fileURLToPath(new URL("../src", import.meta.url));
const mainPath = fileURLToPath(new URL("../src/main.jsx", import.meta.url));
const feedbackPath = fileURLToPath(
  new URL("../src/components/ui/Feedback.jsx", import.meta.url)
);
const confirmationPath = fileURLToPath(
  new URL("../src/components/ui/ConfirmationDialog.jsx", import.meta.url)
);
const toastProviderPath = fileURLToPath(
  new URL("../src/feedback/ToastProvider.jsx", import.meta.url)
);

const findJavaScriptFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findJavaScriptFiles(entryPath)));
    } else if (/\.(?:js|jsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
};

test("API errors prefer safe server messages and retain a useful fallback", () => {
  assert.equal(
    getApiErrorMessage(
      { response: { data: { message: "Room capacity has been reached" } } },
      "Allocation failed"
    ),
    "Room capacity has been reached"
  );
  assert.equal(getApiErrorMessage(new Error("private detail"), "Try again"), "Try again");
  assert.equal(
    getApiErrorMessage({ response: { data: { message: "   " } } }, "Try again"),
    "Try again"
  );
});

test("the app owns one bounded toast region", async () => {
  const [mainSource, providerSource] = await Promise.all([
    readFile(mainPath, "utf8"),
    readFile(toastProviderPath, "utf8"),
  ]);

  assert.match(mainSource, /<ToastProvider>/);
  assert.match(providerSource, /MAX_VISIBLE_TOASTS = 4/);
  assert.match(providerSource, /DEFAULT_DURATION = 5000/);
  assert.match(providerSource, /aria-label="Notifications"/);
  assert.match(providerSource, /clearTimeout/);
});

test("shared feedback distinguishes loading, empty, error, and confirmation", async () => {
  const [feedbackSource, confirmationSource] = await Promise.all([
    readFile(feedbackPath, "utf8"),
    readFile(confirmationPath, "utf8"),
  ]);

  assert.match(feedbackSource, /export const LoadingState/);
  assert.match(feedbackSource, /role="status"/);
  assert.match(feedbackSource, /export const EmptyState/);
  assert.match(feedbackSource, /export const ErrorState/);
  assert.match(feedbackSource, /role="alert"/);
  assert.match(confirmationSource, /data-autofocus/);
  assert.match(confirmationSource, /tone === "danger"/);
  assert.match(confirmationSource, /loadingLabel/);
});

test("active source does not use blocking browser feedback dialogs", async () => {
  const sourceFiles = await findJavaScriptFiles(sourceDirectory);

  for (const file of sourceFiles) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /(?:window\.)?(?:alert|confirm|prompt)\s*\(/);
  }
});
