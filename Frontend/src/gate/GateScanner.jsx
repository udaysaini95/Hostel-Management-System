import { useEffect, useId, useState } from "react";
import { CameraOff } from "lucide-react";
import { Button, Panel } from "../components/ui/index.js";

export const GateScanner = ({ onScan, onClose }) => {
  const generatedId = useId();
  const readerId = `gate-reader-${generatedId.replaceAll(":", "")}`;
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let scanner;
    let disposed = false;

    const startScanner = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeScanner } = await import("html5-qrcode");
        const cameras = await Html5Qrcode.getCameras();

        if (disposed) return;
        if (cameras.length === 0) {
          setCameraError("No camera was found on this device.");
          return;
        }

        scanner = new Html5QrcodeScanner(
          readerId,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          false
        );
        scanner.render(
          (credential) => {
            if (disposed) return;
            onScan(credential);
          },
          () => {
            // Empty frames are expected while the camera searches for a QR.
          }
        );
      } catch {
        if (!disposed) {
          setCameraError(
            "Camera access is unavailable. Continue with the manual pass token."
          );
        }
      }
    };

    startScanner();

    return () => {
      disposed = true;
      scanner?.clear().catch(() => {});
    };
  }, [onScan, readerId]);

  return (
    <Panel className="hm-gate-scanner" aria-labelledby="gate-scanner-title">
      <div className="hm-gate-scanner__heading">
        <div>
          <h2 id="gate-scanner-title">Scan student gate pass</h2>
          <p>Hold the QR code inside the camera frame.</p>
        </div>
        <Button onClick={onClose}>Close camera</Button>
      </div>

      {cameraError ? (
        <div className="hm-gate-scanner__error" role="alert">
          <CameraOff aria-hidden="true" />
          <div>
            <strong>Camera unavailable</strong>
            <span>{cameraError}</span>
          </div>
        </div>
      ) : (
        <div id={readerId} className="hm-gate-scanner__reader" />
      )}

      <p className="hm-gate-scanner__fallback">
        Manual verification remains available above if scanning cannot start.
      </p>
    </Panel>
  );
};
