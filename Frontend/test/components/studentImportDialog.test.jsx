import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import api from "../../src/api/axios.js";
import { StudentImportDialog } from "../../src/onboarding/StudentImportDialog.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/api/axios.js", () => ({
  default: { post: vi.fn() },
}));

vi.mock("../../src/feedback/toastContext.js", () => ({
  useToast: () => ({ showToast }),
}));

const validRows = [
  {
    rowNumber: 2,
    status: "valid",
    values: {
      name: "Asha Rao",
      email: "asha@example.edu",
      rollNo: "2026-CSE-001",
      hostelCode: "H1",
    },
    errors: [],
  },
  {
    rowNumber: 3,
    status: "valid",
    values: {
      name: "Kabir Sen",
      email: "kabir@example.edu",
      rollNo: "2026-CSE-002",
      hostelCode: "H2",
    },
    errors: [],
  },
];

const report = (rows, importedRows = 0) => {
  const invalidRows = rows.filter((row) => row.status === "invalid").length;

  return {
    mode: importedRows ? "import" : "dry-run",
    canImport: invalidRows === 0,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - invalidRows,
      invalidRows,
      importedRows,
    },
    rows,
  };
};

const renderDialog = (props = {}) => {
  const onDismiss = vi.fn();
  const onImported = vi.fn();
  const view = render(
    <StudentImportDialog
      open
      onDismiss={onDismiss}
      onImported={onImported}
      {...props}
    />
  );

  return { ...view, onDismiss, onImported };
};

describe("student CSV import", () => {
  beforeEach(() => {
    api.post.mockReset();
    showToast.mockReset();
  });

  test("requires a CSV file and returns focus to the file field", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Check file" }));

    expect(screen.getByLabelText("CSV file")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a CSV file to review"
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  test("checks the file before importing the confirmed batch", async () => {
    const user = userEvent.setup();
    const dryRunReport = report(validRows);
    const importReport = report(validRows, 2);
    api.post
      .mockResolvedValueOnce({ data: { report: dryRunReport } })
      .mockResolvedValueOnce({ data: { report: importReport } });
    const { onImported } = renderDialog();
    const file = new File(
      ["name,email,roll_no,hostel_code\nAsha Rao,asha@example.edu,2026-CSE-001,H1"],
      "students.csv",
      { type: "text/csv" }
    );

    await user.upload(screen.getByLabelText("CSV file"), file);
    await user.click(screen.getByRole("button", { name: "Check file" }));

    expect(
      await screen.findByRole("heading", { name: "2 students ready" })
    ).toBeVisible();
    const [reviewUrl, reviewBody, reviewConfig] = api.post.mock.calls[0];
    expect(reviewUrl).toBe("/api/admin/students/approvals/import");
    expect(reviewBody.get("file")).toBe(file);
    expect(reviewConfig).toEqual({
      params: { dryRun: true },
      headers: { "Content-Type": undefined },
    });

    await user.click(screen.getByRole("button", { name: "Import 2 students" }));

    await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
    expect(api.post.mock.calls[1][2]).toEqual({
      params: { dryRun: false },
      headers: { "Content-Type": undefined },
    });
    expect(showToast).toHaveBeenCalledWith({
      tone: "success",
      title: "Students imported",
      message: "2 approval records were created.",
    });
  });

  test("shows row-level problems without enabling import", async () => {
    const user = userEvent.setup();
    const invalidRow = {
      ...validRows[0],
      status: "invalid",
      errors: [
        {
          field: "hostel_code",
          code: "HOSTEL_NOT_FOUND",
          message: "No active hostel uses this code",
        },
      ],
    };
    api.post.mockResolvedValue({ data: { report: report([invalidRow]) } });
    const view = renderDialog();
    const file = new File(["invalid row"], "students.csv", {
      type: "text/csv",
    });

    await user.upload(screen.getByLabelText("CSV file"), file);
    await user.click(screen.getByRole("button", { name: "Check file" }));

    const errorList = await screen.findByRole("list", { name: "CSV row errors" });
    expect(within(errorList).getByText("Row 2")).toBeVisible();
    expect(within(errorList).getByText(/No active hostel/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Import 1 student/ })
    ).not.toBeInTheDocument();
    await expectNoAccessibilityViolations(view.baseElement);
  });
});
