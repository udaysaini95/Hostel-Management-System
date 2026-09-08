import { useCallback, useEffect, useRef, useState } from "react";
import { Download, QrCode } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  Panel,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import { downloadGatePassPdf, loadGatePassImage } from "./leaveApi.js";
import {
  formatLeaveDateTime,
  getLeaveStatusDescription,
  getLeaveStatusLabel,
} from "./leaveView.js";

export const ActiveGatePass = ({ leave }) => {
  const [qrUrl, setQrUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [qrLoading, setQrLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const qrUrlRef = useRef("");
  const { showToast } = useToast();

  const fetchQr = useCallback(async () => {
    try {
      setQrLoading(true);
      setQrError("");
      const nextUrl = await loadGatePassImage(leave.id);
      if (qrUrlRef.current) URL.revokeObjectURL(qrUrlRef.current);
      qrUrlRef.current = nextUrl;
      setQrUrl(nextUrl);
    } catch (error) {
      setQrError(
        getApiErrorMessage(error, "The private QR pass could not be loaded.")
      );
    } finally {
      setQrLoading(false);
    }
  }, [leave.id]);

  useEffect(() => {
    fetchQr();
    return () => {
      if (qrUrlRef.current) URL.revokeObjectURL(qrUrlRef.current);
      qrUrlRef.current = "";
    };
  }, [fetchQr]);

  const downloadPdf = async () => {
    try {
      setDownloading(true);
      await downloadGatePassPdf(leave.id);
      showToast({
        tone: "success",
        title: "Gate pass downloaded",
        message: "Keep the PDF private and present it only to authorized gate staff.",
      });
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Gate pass download failed",
        message: getApiErrorMessage(error, "Try downloading the PDF again."),
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Panel className="hm-leave-pass" aria-labelledby="active-pass-title">
      <div className="hm-leave-pass__heading">
        <div>
          <p className="hm-leave-pass__eyebrow">Current gate pass</p>
          <h2 id="active-pass-title">{getLeaveStatusLabel(leave.status)}</h2>
          <p>{getLeaveStatusDescription(leave.status)}</p>
        </div>
        <Badge tone={leave.status === "approved" ? "success" : "info"}>
          {getLeaveStatusLabel(leave.status)}
        </Badge>
      </div>

      <div className="hm-leave-pass__body">
        <div className="hm-leave-pass__qr">
          {qrLoading ? (
            <LoadingState
              label="Loading private gate-pass QR code"
              rows={2}
              compact
            />
          ) : qrError ? (
            <ErrorState
              title="QR pass unavailable"
              description={qrError}
              onRetry={fetchQr}
            />
          ) : (
            <img
              src={qrUrl}
              alt="QR code for the current HostelMate gate pass"
            />
          )}
        </div>

        <div className="hm-leave-pass__details">
          <dl>
            <div>
              <dt>Hostel and room</dt>
              <dd>
                {leave.hostel.code} · {leave.room
                  ? `${leave.room.blockCode}-${leave.room.roomNumber}`
                  : "Room unavailable"}
              </dd>
            </div>
            <div>
              <dt>Valid from</dt>
              <dd>{formatLeaveDateTime(leave.pass.validFrom)}</dd>
            </div>
            <div>
              <dt>Valid until</dt>
              <dd>{formatLeaveDateTime(leave.pass.expiresAt)}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{leave.reason}</dd>
            </div>
          </dl>
          <p className="hm-leave-pass__notice">
            <QrCode aria-hidden="true" />
            <span>
              Gate staff verify this QR against the live record. A screenshot
              alone does not authorize movement.
            </span>
          </p>
          <Button
            leadingIcon={<Download aria-hidden="true" />}
            loading={downloading}
            loadingLabel="Downloading pass"
            onClick={downloadPdf}
          >
            Download PDF
          </Button>
        </div>
      </div>
    </Panel>
  );
};
