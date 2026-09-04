import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAssetUrl,
  buildUploadUrl,
  createServiceUrlConfig,
  FrontendConfigurationError,
} from "../src/config/serviceUrls.js";

const sourceDirectory = fileURLToPath(new URL("../src", import.meta.url));

const findSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findSourceFiles(entryPath)));
    } else if (/\.(?:js|jsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
};

test("service URLs use the current origin when no environment is configured", () => {
  assert.deepEqual(createServiceUrlConfig(), {
    apiBaseUrl: "",
    assetBaseUrl: "",
  });
});

test("service URL configuration normalizes API and asset origins", () => {
  assert.deepEqual(
    createServiceUrlConfig({
      VITE_API_BASE_URL: " https://api.hostelmate.example/ ",
    }),
    {
      apiBaseUrl: "https://api.hostelmate.example",
      assetBaseUrl: "https://api.hostelmate.example",
    }
  );

  assert.deepEqual(
    createServiceUrlConfig({
      VITE_API_BASE_URL: "https://api.hostelmate.example",
      VITE_ASSET_BASE_URL: "https://assets.hostelmate.example/",
    }),
    {
      apiBaseUrl: "https://api.hostelmate.example",
      assetBaseUrl: "https://assets.hostelmate.example",
    }
  );
});

test("service URL configuration rejects unsafe or ambiguous origins", () => {
  for (const value of [
    "ftp://api.hostelmate.example",
    "https://user:password@api.hostelmate.example",
    "https://api.hostelmate.example/v1",
    "https://api.hostelmate.example?region=one",
    "not-a-url",
  ]) {
    assert.throws(
      () => createServiceUrlConfig({ VITE_API_BASE_URL: value }),
      FrontendConfigurationError
    );
  }

  assert.throws(
    () => createServiceUrlConfig({ VITE_ASSET_BASE_URL: 5000 }),
    FrontendConfigurationError
  );
});

test("asset helpers encode local paths and use the configured asset origin", () => {
  assert.equal(
    buildAssetUrl("images/hostel map.svg", "https://assets.example.test"),
    "https://assets.example.test/images/hostel%20map.svg"
  );
  assert.equal(
    buildUploadUrl(
      "/uploads/complaints/photo one.jpg",
      "https://assets.example.test"
    ),
    "https://assets.example.test/uploads/complaints/photo%20one.jpg"
  );
  assert.equal(
    buildUploadUrl("passes\\approved-pass.pdf", ""),
    "/uploads/passes/approved-pass.pdf"
  );
});

test("asset helpers reject external, empty, and traversal references", () => {
  for (const value of [
    "",
    "../private.txt",
    "folder/../../private.txt",
    "https://untrusted.example/file.pdf",
    "//untrusted.example/file.pdf",
  ]) {
    assert.equal(buildUploadUrl(value, "https://assets.example.test"), null);
  }
});

test("active frontend source contains no localhost-only service URL", async () => {
  const sourceFiles = await findSourceFiles(sourceDirectory);

  for (const file of sourceFiles) {
    const contents = await readFile(file, "utf8");
    assert.doesNotMatch(contents, /https?:\/\/(?:localhost|127\.0\.0\.1)/i);
  }
});
