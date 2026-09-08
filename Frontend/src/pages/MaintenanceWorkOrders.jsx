import { useCallback, useEffect, useState } from "react";
import { FilterX, Search } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Panel,
  Select,
} from "../components/ui/index.js";
import { ComplaintResolutionDialog } from "../complaints/ComplaintResolutionDialog.jsx";
import {
  getComplaint,
  getMaintenanceWorkQueue,
  startComplaintWork,
} from "../complaints/complaintApi.js";
import { MaintenanceWorkDrawer } from "../complaints/MaintenanceWorkDrawer.jsx";
import { MaintenanceWorkQueue } from "../complaints/MaintenanceWorkQueue.jsx";
import { useToast } from "../feedback/toastContext.js";

const EMPTY_PAGINATION = Object.freeze({
  page: 1,
  pageSize: 12,
  total: 0,
  totalPages: 0,
});

const DEFAULT_FILTERS = Object.freeze({
  search: "",
  status: "",
  priority: "",
  slaState: "open",
});

const getRequestFilters = (view, filters) => {
  const shared = {
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
  };

  if (view === "awaiting") {
    return {
      ...shared,
      status: "resolved",
      slaState: "all",
      sortBy: "updatedAt",
      sortOrder: "desc",
    };
  }

  return {
    ...shared,
    ...(filters.status ? { status: filters.status } : {}),
    slaState: filters.slaState,
    sortBy: "priority",
    sortOrder: "asc",
  };
};

const MaintenanceWorkOrders = () => {
  const { showToast } = useToast();
  const [view, setView] = useState("active");
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [startTarget, setStartTarget] = useState(null);
  const [resolutionTarget, setResolutionTarget] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState("");

  const loadWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const result = await getMaintenanceWorkQueue({
        page,
        ...getRequestFilters(view, filters),
      });
      setComplaints(result.data);
      setPagination(result.pagination);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, "Your assigned work could not be loaded.")
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page, view]);

  const loadSelectedComplaint = useCallback(async () => {
    if (!selectedId) return;

    try {
      setDetailLoading(true);
      setDetailError("");
      const result = await getComplaint(selectedId);
      if (!result.complaint) throw new Error("Work order response was empty");
      setSelectedComplaint(result.complaint);
      setAttachments(result.attachments);
    } catch (error) {
      setDetailError(
        getApiErrorMessage(error, "This work order could not be loaded.")
      );
    } finally {
      setDetailLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  useEffect(() => {
    if (selectedId) loadSelectedComplaint();
  }, [loadSelectedComplaint, selectedId]);

  const updateDraftFilter = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setFilters({ ...draftFilters });
    setPage(1);
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const changeView = (nextView) => {
    setView(nextView);
    setPage(1);
    setSelectedId(null);
    setSelectedComplaint(null);
    setAttachments([]);
  };

  const openWorkOrder = (complaintId) => {
    setSelectedComplaint(null);
    setAttachments([]);
    setDetailError("");
    setSelectedId(complaintId);
  };

  const closeWorkOrder = () => {
    setSelectedId(null);
    setSelectedComplaint(null);
    setAttachments([]);
    setDetailError("");
  };

  const askToStart = (complaint) => {
    setTransitionError("");
    setStartTarget(complaint);
  };

  const startWork = async () => {
    if (!startTarget) return;

    try {
      setTransitioning(true);
      setTransitionError("");
      const updatedComplaint = await startComplaintWork(startTarget.id);
      setComplaints((current) =>
        current.map((complaint) =>
          complaint.id === updatedComplaint.id ? updatedComplaint : complaint
        )
      );
      if (selectedId === updatedComplaint.id) {
        setSelectedComplaint(updatedComplaint);
      }
      setStartTarget(null);
      showToast({
        tone: "success",
        title: "Work started",
        message: `Complaint #${updatedComplaint.id} is now in progress.`,
      });
    } catch (error) {
      setTransitionError(
        getApiErrorMessage(error, "This work order could not be started.")
      );
    } finally {
      setTransitioning(false);
    }
  };

  const finishResolution = (result) => {
    const resolvedComplaint = result.complaint;
    setComplaints((current) =>
      current.filter((complaint) => complaint.id !== resolvedComplaint.id)
    );
    setPagination((current) => ({
      ...current,
      total: Math.max(0, current.total - 1),
      totalPages:
        current.total <= 1
          ? 0
          : Math.ceil((current.total - 1) / current.pageSize),
    }));
    if (complaints.length === 1 && page > 1) {
      setPage((current) => current - 1);
    }
    setResolutionTarget(null);
    if (selectedId === resolvedComplaint.id) closeWorkOrder();
    showToast({
      tone: "success",
      title: "Resolution submitted",
      message: "The work order moved to awaiting student confirmation.",
    });
  };

  const hasCustomFilters = Object.entries(DEFAULT_FILTERS).some(
    ([key, value]) => draftFilters[key] !== value || filters[key] !== value
  );
  const awaitingView = view === "awaiting";

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-complaints hm-work-orders">
      <PageHeader
        eyebrow="Maintenance"
        title="Assigned work"
        description="Work only on complaints assigned to you, record progress, and submit clear resolution evidence."
      />

      <div className="hm-work-orders__tabs" role="tablist" aria-label="Work order views">
        <button
          type="button"
          role="tab"
          aria-selected={!awaitingView}
          onClick={() => changeView("active")}
        >
          Active work
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={awaitingView}
          onClick={() => changeView("awaiting")}
        >
          Awaiting student confirmation
        </button>
      </div>

      <Panel padding="compact">
        <form className="hm-work-orders__filters" onSubmit={applyFilters}>
          <Input
            label="Search assigned work"
            type="search"
            startIcon={<Search aria-hidden="true" />}
            placeholder="Category, student, or location"
            value={draftFilters.search}
            onChange={(event) => updateDraftFilter("search", event.target.value)}
          />
          {!awaitingView && (
            <Select
              label="Status"
              value={draftFilters.status}
              onChange={(event) => updateDraftFilter("status", event.target.value)}
            >
              <option value="">Assigned and in progress</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In progress</option>
            </Select>
          )}
          <Select
            label="Priority"
            value={draftFilters.priority}
            onChange={(event) => updateDraftFilter("priority", event.target.value)}
          >
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          {!awaitingView && (
            <Select
              label="SLA risk"
              value={draftFilters.slaState}
              onChange={(event) => updateDraftFilter("slaState", event.target.value)}
            >
              <option value="open">All active work</option>
              <option value="breached">Breached only</option>
            </Select>
          )}
          <div className="hm-work-orders__filter-actions">
            <Button type="submit" variant="primary">Apply filters</Button>
            <Button
              leadingIcon={<FilterX aria-hidden="true" />}
              disabled={!hasCustomFilters}
              onClick={resetFilters}
            >
              Reset
            </Button>
          </div>
        </form>
      </Panel>

      <div className="hm-work-orders__summary" aria-live="polite">
        <strong>{loading ? "Loading work" : `${pagination.total} work order${pagination.total === 1 ? "" : "s"}`}</strong>
        <span>
          {awaitingView
            ? "Resolved work remains here until the student confirms it."
            : "Critical priority and SLA risk appear first."}
        </span>
      </div>

      {loading ? (
        <LoadingState label="Loading assigned maintenance work" rows={6} />
      ) : loadError ? (
        <ErrorState
          title="Assigned work unavailable"
          description={loadError}
          onRetry={loadWorkOrders}
        />
      ) : complaints.length === 0 ? (
        <EmptyState
          title={awaitingView ? "No work awaiting confirmation" : "No active work assigned"}
          description={
            awaitingView
              ? "Resolved work will appear here while the reporting student reviews it."
              : "New work appears here after a warden assigns a complaint to you."
          }
          action={
            <Button onClick={hasCustomFilters ? resetFilters : loadWorkOrders}>
              {hasCustomFilters ? "Reset filters" : "Refresh work"}
            </Button>
          }
        />
      ) : (
        <Panel padding="none" className="hm-work-orders__queue">
          <MaintenanceWorkQueue
            complaints={complaints}
            onOpen={openWorkOrder}
            onResolve={setResolutionTarget}
            onStart={askToStart}
          />
          <nav className="hm-complaints__pagination" aria-label="Assigned work pagination">
            <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
            <div>
              <Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <Button
                disabled={pagination.totalPages === 0 || page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
        </Panel>
      )}

      <MaintenanceWorkDrawer
        open={Boolean(selectedId) && !startTarget && !resolutionTarget}
        complaint={selectedComplaint}
        attachments={attachments}
        loading={detailLoading}
        error={detailError}
        onDismiss={closeWorkOrder}
        onResolve={setResolutionTarget}
        onRetry={loadSelectedComplaint}
        onStart={askToStart}
      />

      <ConfirmationDialog
        open={Boolean(startTarget)}
        title="Start this work order?"
        description="This records that repair work is in progress and updates the student-facing timeline."
        confirmLabel="Start work"
        loadingLabel="Starting work"
        loading={transitioning}
        onConfirm={startWork}
        onDismiss={() => {
          setStartTarget(null);
          setTransitionError("");
        }}
      >
        {transitionError && <p className="hm-complaints__form-error" role="alert">{transitionError}</p>}
      </ConfirmationDialog>

      <ComplaintResolutionDialog
        complaint={resolutionTarget}
        onDismiss={() => setResolutionTarget(null)}
        onResolved={finishResolution}
      />
    </div>
  );
};

export default MaintenanceWorkOrders;
