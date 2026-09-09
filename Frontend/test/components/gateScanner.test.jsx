import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { GateScanner } from "../../src/gate/GateScanner.jsx";

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: {
    getCameras: vi.fn().mockRejectedValue(new Error("Permission denied")),
  },
  Html5QrcodeScanner: vi.fn(),
}));

describe("gate camera scanner", () => {
  test("keeps manual verification available when camera access fails", async () => {
    render(<GateScanner onScan={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Camera access is unavailable"
    );
    expect(screen.getByText(/Manual verification remains available/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Close camera" })).toBeEnabled();
  });
});
