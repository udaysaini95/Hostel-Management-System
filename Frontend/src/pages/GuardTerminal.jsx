import { useCallback, useEffect, useState } from "react";
import { Camera, Search, ShieldCheck } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import { useAuth } from "../auth/authContext.js";
import { USER_ROLES } from "../auth/roles.js";
import {
  Button,
  Input,
  PageHeader,
  Panel,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  listGateMovements,
  listOutsideRoster,
  recordGateMovement,
  verifyGatePass,
} from "../gate/gateApi.js";
import { GateScanner } from "../gate/GateScanner.jsx";
import { GateVerificationResult } from "../gate/GateVerificationResult.jsx";
import { MovementHistory } from "../gate/MovementHistory.jsx";
import { OutsideRoster } from "../gate/OutsideRoster.jsx";
import {
  createMovementKey,
  normalizeGateCredential,
  validateGateCredential,
} from "../gate/gateView.js";

const EMPTY_ROSTER_PAGE = Object.freeze({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
});

const EMPTY_HISTORY_PAGE = Object.freeze({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
});

const GuardTerminal = () => {
  const { user } = useAuth();
  const canOperate = [USER_ROLES.GUARD, USER_ROLES.ADMIN].includes(user?.role);
  const { showToast } = useToast();

  const [credential, setCredential] = useState("");
  const [credentialError, setCredentialError] = useState("");
  const [verifiedCredential, setVerifiedCredential] = useState("");
  const [verification, setVerification] = useState(null);
  const [verificationError, setVerificationError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [movementKey, setMovementKey] = useState("");
  const [movement, setMovement] = useState(null);
  const [movementError, setMovementError] = useState("");
  const [recording, setRecording] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [roster, setRoster] = useState([]);
  const [rosterPagination, setRosterPagination] = useState(EMPTY_ROSTER_PAGE);
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterSearchDraft, setRosterSearchDraft] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [overdue, setOverdue] = useState("all");
  const [generatedAt, setGeneratedAt] = useState("");
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterRefreshing, setRosterRefreshing] = useState(false);
  const [rosterError, setRosterError] = useState("");

  const [history, setHistory] = useState([]);
  const [historyPagination, setHistoryPagination] = useState(EMPTY_HISTORY_PAGE);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearchDraft, setHistorySearchDraft] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyMovement, setHistoryMovement] = useState("all");
  const [verificationType, setVerificationType] = useState("all");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  const loadRoster = useCallback(async ({ background = false } = {}) => {
    try {
      if (background) setRosterRefreshing(true);
      else setRosterLoading(true);
      setRosterError("");
      const result = await listOutsideRoster({
        page: rosterPage,
        pageSize: 10,
        ...(rosterSearch ? { search: rosterSearch } : {}),
        ...(overdue === "overdue" ? { overdue: true } : {}),
        ...(overdue === "on-time" ? { overdue: false } : {}),
      });
      setRoster(result?.data ?? []);
      setRosterPagination(result?.pagination ?? EMPTY_ROSTER_PAGE);
      setGeneratedAt(result?.generatedAt ?? new Date().toISOString());
    } catch (error) {
      setRosterError(
        getApiErrorMessage(error, "The live outside roster could not be loaded.")
      );
    } finally {
      setRosterLoading(false);
      setRosterRefreshing(false);
    }
  }, [overdue, rosterPage, rosterSearch]);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError("");
      const result = await listGateMovements({
        page: historyPage,
        pageSize: 10,
        ...(historySearch ? { search: historySearch } : {}),
        ...(historyMovement !== "all" ? { movement: historyMovement } : {}),
        ...(verificationType === "override" ? { overrideOnly: true } : {}),
        ...(verificationType === "standard" ? { overrideOnly: false } : {}),
      });
      setHistory(result?.data ?? []);
      setHistoryPagination(result?.pagination ?? EMPTY_HISTORY_PAGE);
    } catch (error) {
      setHistoryError(
        getApiErrorMessage(error, "Recent gate movements could not be loaded.")
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [historyMovement, historyPage, historySearch, verificationType]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => loadRoster({ background: true }),
      15_000
    );
    return () => window.clearInterval(intervalId);
  }, [loadRoster]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const verifyCredential = useCallback(async (rawCredential) => {
    const cleanCredential = normalizeGateCredential(rawCredential);
    const validationError = validateGateCredential(cleanCredential);

    setCredentialError(validationError);
    setVerificationError("");
    setMovementError("");
    setMovement(null);
    setVerifiedCredential("");
    setMovementKey("");
    if (validationError) return;

    try {
      setVerifying(true);
      const result = await verifyGatePass(cleanCredential);
      setVerification(result);
      setVerifiedCredential(cleanCredential);
      setMovementKey(
        result?.permittedAction
          ? createMovementKey(result.permittedAction)
          : ""
      );
    } catch (error) {
      setVerification(null);
      setVerificationError(
        getApiErrorMessage(error, "The gate pass could not be verified.")
      );
    } finally {
      setVerifying(false);
    }
  }, []);

  const submitVerification = (event) => {
    event.preventDefault();
    verifyCredential(credential);
  };

  const handleScan = useCallback((scannedCredential) => {
    setScannerOpen(false);
    setCredential(scannedCredential);
    verifyCredential(scannedCredential);
  }, [verifyCredential]);

  const recordMovement = async (action) => {
    try {
      setRecording(true);
      setMovementError("");
      const result = await recordGateMovement({
        credential: verifiedCredential,
        action,
        idempotencyKey: movementKey,
      });
      setMovement(result);
      showToast({
        tone: "success",
        title: action === "exit" ? "Student exit recorded" : "Student return recorded",
        message: "The hostel roster and movement history have been updated.",
      });
      await Promise.all([
        loadRoster({ background: true }),
        loadHistory(),
      ]);
    } catch (error) {
      setMovementError(
        getApiErrorMessage(
          error,
          "The movement was not recorded. Retry with the same verified pass."
        )
      );
    } finally {
      setRecording(false);
    }
  };

  const submitRosterFilters = (event) => {
    event.preventDefault();
    const nextSearch = rosterSearchDraft.trim();
    setRosterPage(1);
    setRosterSearch(nextSearch);
    if (rosterPage === 1 && rosterSearch === nextSearch) loadRoster();
  };

  const submitHistoryFilters = (event) => {
    event.preventDefault();
    const nextSearch = historySearchDraft.trim();
    setHistoryPage(1);
    setHistorySearch(nextSearch);
    if (historyPage === 1 && historySearch === nextSearch) loadHistory();
  };

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-gate-terminal">
      <PageHeader
        eyebrow={canOperate ? "Gate security" : "Hostel operations"}
        title={canOperate ? "Gate verification terminal" : "Gate activity"}
        description={
          canOperate
            ? "Verify one secure pass, perform only the server-authorized movement, and monitor live hostel activity."
            : "Monitor students outside campus and review gate movement history for your assigned hostels."
        }
      />

      {canOperate && (
        <section className="hm-gate-verify" aria-labelledby="gate-verify-title">
          <div className="hm-gate-section__heading">
            <div>
              <h2 id="gate-verify-title">Verify a gate pass</h2>
              <p>Scan the student QR or enter the complete private pass token.</p>
            </div>
          </div>

          <Panel as="form" className="hm-gate-verify__controls" onSubmit={submitVerification}>
            <Input
              label="Gate-pass token"
              placeholder="43-character token"
              autoComplete="off"
              spellCheck="false"
              maxLength={70}
              startIcon={<Search />}
              error={credentialError}
              value={credential}
              onChange={(event) => {
                setCredential(event.target.value);
                setCredentialError("");
                setVerification(null);
                setVerificationError("");
                setMovement(null);
                setVerifiedCredential("");
                setMovementKey("");
              }}
            />
            <div className="hm-gate-verify__buttons">
              <Button
                type="submit"
                variant="primary"
                size="touch"
                loading={verifying}
                loadingLabel="Verifying pass"
              >
                Verify pass
              </Button>
              <Button
                size="touch"
                leadingIcon={<Camera aria-hidden="true" />}
                onClick={() => setScannerOpen((open) => !open)}
              >
                {scannerOpen ? "Close camera" : "Scan QR"}
              </Button>
            </div>
          </Panel>

          {scannerOpen && (
            <GateScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />
          )}

          {verificationError && (
            <div className="hm-gate-verify__error" role="alert">
              <ShieldCheck aria-hidden="true" /> {verificationError}
            </div>
          )}

          <GateVerificationResult
            verification={verification}
            movement={movement}
            actionError={movementError}
            recording={recording}
            onRecord={recordMovement}
          />
        </section>
      )}

      <OutsideRoster
        records={roster}
        pagination={rosterPagination}
        generatedAt={generatedAt}
        loading={rosterLoading}
        refreshing={rosterRefreshing}
        error={rosterError}
        searchDraft={rosterSearchDraft}
        overdue={overdue}
        onSearchDraftChange={setRosterSearchDraft}
        onOverdueChange={(value) => {
          setOverdue(value);
          setRosterPage(1);
        }}
        onSubmit={submitRosterFilters}
        onRetry={() => loadRoster()}
        onPageChange={setRosterPage}
      />

      <MovementHistory
        records={history}
        pagination={historyPagination}
        loading={historyLoading}
        error={historyError}
        searchDraft={historySearchDraft}
        movement={historyMovement}
        verificationType={verificationType}
        onSearchDraftChange={setHistorySearchDraft}
        onMovementChange={(value) => {
          setHistoryMovement(value);
          setHistoryPage(1);
        }}
        onVerificationTypeChange={(value) => {
          setVerificationType(value);
          setHistoryPage(1);
        }}
        onSubmit={submitHistoryFilters}
        onRetry={loadHistory}
        onPageChange={setHistoryPage}
      />
    </div>
  );
};

export default GuardTerminal;
