import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { joinClassNames } from "../src/components/ui/classNames.js";
import {
  BADGE_TONES,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  getBadgeClassName,
  getButtonClassName,
  getPanelClassName,
  getStatusTone,
  getToastClassName,
  PANEL_PADDING,
  PANEL_VARIANTS,
  TOAST_TONES,
} from "../src/components/ui/primitiveStyles.js";
import {
  getFocusableElements,
  handleFocusTrapKeyDown,
} from "../src/components/ui/focusTrap.js";

const themePath = fileURLToPath(
  new URL("../src/styles/theme.css", import.meta.url)
);
const componentsPath = fileURLToPath(
  new URL("../src/styles/components.css", import.meta.url)
);
const uiIndexPath = fileURLToPath(
  new URL("../src/components/ui/index.js", import.meta.url)
);

const createKeyboardEvent = (key, shiftKey = false) => ({
  key,
  shiftKey,
  defaultPrevented: false,
  preventDefault() {
    this.defaultPrevented = true;
  },
});

const createFocusFixture = (elementCount = 2) => {
  const ownerDocument = { activeElement: null };
  const elements = Array.from({ length: elementCount }, (_, index) => ({
    name: `element-${index + 1}`,
    getAttribute: () => null,
    focus() {
      ownerDocument.activeElement = this;
    },
  }));
  const container = {
    ownerDocument,
    querySelectorAll: () => elements,
    contains: (element) => elements.includes(element),
    focus() {
      ownerDocument.activeElement = this;
    },
  };

  return { container, elements, ownerDocument };
};

test("the theme defines every approved semantic color in one place", async () => {
  const theme = await readFile(themePath, "utf8");
  const approvedColors = {
    canvas: "#f7f5f0",
    surface: "#ffffff",
    "surface-subtle": "#eef1f6",
    "surface-selected": "#e7edff",
    "text-primary": "#111c35",
    "text-secondary": "#4f5d72",
    "text-muted": "#748095",
    border: "#d8dce3",
    "border-strong": "#b9c0cc",
    brand: "#2f57d5",
    "brand-hover": "#2448ba",
    "brand-soft": "#e7edff",
    success: "#13795b",
    "success-soft": "#eaf7f1",
    warning: "#a85d00",
    "warning-soft": "#fff4df",
    danger: "#b42318",
    "danger-hover": "#912018",
    "danger-soft": "#fdecea",
    "danger-border": "#f2b8b5",
    info: "#175cd3",
    "info-soft": "#eaf2ff",
    focus: "#86a4ff",
    overlay: "rgba(17, 28, 53, 0.6)",
  };

  for (const [token, value] of Object.entries(approvedColors)) {
    assert.ok(
      theme.toLowerCase().includes(`--color-${token}: ${value}`),
      `Missing --color-${token}`
    );
  }
});

test("class composition keeps supported variants explicit", () => {
  assert.equal(joinClassNames("one", false, ["two", "", null]), "one two");

  for (const [variant, variantClass] of Object.entries(BUTTON_VARIANTS)) {
    assert.match(getButtonClassName({ variant }), new RegExp(variantClass));
  }

  for (const [size, sizeClass] of Object.entries(BUTTON_SIZES)) {
    assert.ok(getButtonClassName({ size }).includes(sizeClass));
  }

  for (const [tone, toneClass] of Object.entries(BADGE_TONES)) {
    assert.match(getBadgeClassName({ tone }), new RegExp(toneClass));
  }

  for (const [variant, variantClass] of Object.entries(PANEL_VARIANTS)) {
    assert.ok(getPanelClassName({ variant }).includes(variantClass));
  }

  for (const [padding, paddingClass] of Object.entries(PANEL_PADDING)) {
    assert.ok(getPanelClassName({ padding }).includes(paddingClass));
  }

  for (const [tone, toneClass] of Object.entries(TOAST_TONES)) {
    assert.ok(getToastClassName({ tone }).includes(toneClass));
  }

  assert.throws(
    () => getButtonClassName({ variant: "gradient" }),
    /does not support/
  );
});

test("workflow statuses use a stable semantic tone", () => {
  assert.equal(getStatusTone("Created"), "info");
  assert.equal(getStatusTone("Assigned"), "brand");
  assert.equal(getStatusTone("In-progress"), "info");
  assert.equal(getStatusTone("Pending"), "warning");
  assert.equal(getStatusTone("Approved"), "success");
  assert.equal(getStatusTone("overdue"), "danger");
  assert.equal(getStatusTone("Closed"), "neutral");
  assert.equal(getStatusTone("Unknown future status"), "neutral");
});

test("focus trap finds interactive elements and wraps Tab navigation", () => {
  const { container, elements, ownerDocument } = createFocusFixture();
  assert.deepEqual(getFocusableElements(container), elements);

  ownerDocument.activeElement = elements.at(-1);
  const forwardTab = createKeyboardEvent("Tab");
  handleFocusTrapKeyDown(forwardTab, container);
  assert.equal(ownerDocument.activeElement, elements[0]);
  assert.equal(forwardTab.defaultPrevented, true);

  ownerDocument.activeElement = elements[0];
  const backwardTab = createKeyboardEvent("Tab", true);
  handleFocusTrapKeyDown(backwardTab, container);
  assert.equal(ownerDocument.activeElement, elements.at(-1));
  assert.equal(backwardTab.defaultPrevented, true);
});

test("focus trap handles Escape and an overlay with no controls", () => {
  const emptyFixture = createFocusFixture(0);
  const tabEvent = createKeyboardEvent("Tab");
  handleFocusTrapKeyDown(tabEvent, emptyFixture.container);
  assert.equal(emptyFixture.ownerDocument.activeElement, emptyFixture.container);
  assert.equal(tabEvent.defaultPrevented, true);

  let dismissed = false;
  const escapeEvent = createKeyboardEvent("Escape");
  handleFocusTrapKeyDown(escapeEvent, emptyFixture.container, () => {
    dismissed = true;
  });
  assert.equal(dismissed, true);
  assert.equal(escapeEvent.defaultPrevented, true);
});

test("shared styles retain visible focus and reduced-motion behavior", async () => {
  const [theme, components] = await Promise.all([
    readFile(themePath, "utf8"),
    readFile(componentsPath, "utf8"),
  ]);

  assert.match(theme, /:focus-visible\s*{/);
  assert.match(theme, /outline:\s*3px solid var\(--color-focus\)/);
  assert.match(theme, /prefers-reduced-motion:\s*reduce/);
  assert.match(components, /\.hm-button--icon/);
  assert.match(components, /min-height:\s*2\.75rem/);
});

test("the public UI entry point exports every required primitive", async () => {
  const uiIndex = await readFile(uiIndexPath, "utf8");
  const requiredPrimitives = [
    "Badge",
    "Button",
    "ButtonLink",
    "ConfirmationDialog",
    "Dialog",
    "Drawer",
    "EmptyState",
    "ErrorState",
    "Input",
    "LoadingState",
    "PageHeader",
    "Panel",
    "Select",
    "Skeleton",
    "Table",
    "Textarea",
    "Toast",
  ];

  for (const primitive of requiredPrimitives) {
    assert.match(uiIndex, new RegExp(`\\b${primitive}\\b`));
  }
});
