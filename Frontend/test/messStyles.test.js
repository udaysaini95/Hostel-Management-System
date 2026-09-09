import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesUrl = new URL("../src/styles/mess.css", import.meta.url);
const studentPageUrl = new URL("../src/pages/MessPage.jsx", import.meta.url);

test("mess screens keep calendar navigation and mobile touch behavior", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /grid-template-columns: repeat\(7/);
  assert.match(styles, /min-height: var\(--spacing-touch\)/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /overflow-x: auto/);
});

test("student mess source contains no fabricated fallback menu", async () => {
  const source = await readFile(studentPageUrl, "utf8");
  assert.doesNotMatch(source, /Boiled Eggs|Paneer Butter Masala|Gulab Jamun/);
  assert.match(source, /MessMenuBrowser/);
});
