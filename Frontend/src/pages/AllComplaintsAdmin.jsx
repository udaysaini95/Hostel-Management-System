import { useCallback, useEffect, useState } from "react";
import { FilterX, Search } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Panel,
  Select,
} from "../components/ui/index.js";
import { ComplaintAssignmentDialog } from "../complaints/ComplaintAssignmentDialog.jsx";
import {
  getComplaint,
  getComplaintCategories,
  getManagedComplaints,
} from "../complaints/complaintApi.js";
import { ManagedComplaintDrawer } from "../complaints/ManagedComplaintDrawer.jsx";
import { ManagedComplaintQueue } from "../complaints/ManagedComplaintQueue.jsx";
import {
  COMPLAINT_STATUSES,
  getComplaintStatusLabel,
} from "../complaints/complaintView.js";
import { useToast } from "../feedback/toastContext.js";

const EMPTY_PAGINATION = Object.freeze({
  page: 1,
  pageSize: 15,
  total: 0,
  totalPages: 0,
});

const DEFAULT_FILTERS = Object.freeze({
  search: "",
  hostelCode: "",
  categoryCode: "",
  status: "",
  priority: "",
  slaState: "open",
  sort: "slaDeadline:asc",
});

const getRequestFilters = (filters) => {
  const [sortBy, sortOrder] = filters.sort.split(":");

  return {
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.hostelCode.trim()
      ? { hostelCode: filters.hostelCode.trim().toUpperCase() }
      : {}),
    ...(filters.categoryCode ? { categoryCode: filters.categoryCode } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    slaState: filters.slaState,
    sortBy,
    sortOrder,
  };
};

const AllComplaintsAdmin = () => {
  const { showToast } = useToast();
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [categories, setCategories] = useState([]);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [assignmentTarget, setAssignmentTarget] = useState(null);

  const loadComplaints = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const result = await getManagedComplaints({
        page,
        ...getRequestFilters(filters),
      });
      setComplaints(result.data);
      setPagination(result.pagination);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, "The managed complaint queue could not be loaded.")
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  const loadSelectedComplaint = useCallback(async () => {
    if (!selectedId) return;

    try {
      setDetailLoading(true);
      setDetailError("");
      const result = await getComplaint(selectedId);
      if (!result.complaint) throw new Error("Complaint response was empty");
      setSelectedComplaint(result.complaint);
      setAttachments(result.attachments);
    } catch (error) {
      setDetailError(
        getApiErrorMessage(error, "The complaint details could not be loaded.")
      );
    } finally {
      setDetailLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  useEffect(() => {
    getComplaintCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (selectedId) loadSelectedComplaint();
  }, [loadSelectedComplaint, selectedId]);

  const updateDraftFilter = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draftFilters });
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const openComplaint = (complaintId) => {
    setSelectedComplaint(null);
    setAttachments([]);
    setDetailError("");
    setSelectedId(complaintId);
  };

  const closeComplaint = () => {
    setSelectedId(null);
    setSelectedComplaint(null);
    setAttachments([]);
    setDetailError("");
  };

  const finishAssignment = (updatedComplaint) => {
    const reassigned = Boolean(assignmentTarget?.assignment);
    setComplaints((current) =>
      current.map((complaint) =>
        complaint.id === updatedComplaint.id ? updatedComplaint : complaint
      )
    );
    if (selectedId === updatedComplaint.id) {
      setSelectedComplaint(updatedComplaint);
    }
    setAssignmentTarget(null);
    showToast({
      tone: "success",
      title: reassigned ? "Complaint reassigned" : "Complaint assigned",
      message: `${updatedComplaint.assignment.assignee.name} now owns this maintenance task.`,
    });
  };

  const hasCustomFilters = Object.entries(DEFAULT_FILTERS).some(
    ([key, value]) => draftFilters[key] !== value || filters[key] !== value
  );

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-complaints hm-managed-complaints">
      <PageHeader
        eyebrow="Maintenance operations"
        title="Complaint queue"
        description="Review hostel maintenance reports, track SLA risk, and assign work to available technicians."
      />

      <Panel padding="compact">
        <form className="hm-managed-complaints__filters" onSubmit={applyFilters}>
          <Input
            label="Search"
            type="search"
            startIcon={<Search aria-hidden="true" />}
            placeholder="Student, category, or location"
            value={draftFilters.search}
            onChange={(event) => updateDraftFilter("search", event.target.value)}
          />
          <Input
            label="Hostel code"
            placeholder="For example H1"
            maxLength={20}
            value={draftFilters.hostelCode}
            onChange={(event) => updateDraftFilter("hostelCode", event.target.value)}
          />
          <Select
            label="Category"
            value={draftFilters.categoryCode}
            onChange={(event) => updateDraftFilter("categoryCode", event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.code} value={category.code}>{category.name}</option>
            ))}
          </Select>
          <Select
            label="Status"
            value={draftFilters.status}
            onChange={(event) => updateDraftFilter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {COMPLAINT_STATUSES.map((status) => (
              <option key={status} value={status}>{getComplaintStatusLabel(status)}</option>
            ))}
          </Select>
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
          <Select
            label="SLA view"
            value={draftFilters.slaState}
            onChange={(event) => updateDraftFilter("slaState", event.target.value)}
          >
            <option value="open">Open work</option>
            <option value="breached">Breached only</option>
            <option value="all">All complaints</option>
          </Select>
          <Select
            label="Sort by"
            value={draftFilters.sort}
            onChange={(event) => updateDraftFilter("sort", event.target.value)}
          >
            <option value="slaDeadline:asc">SLA deadline · soonest</option>
            <option value="priority:asc">Priority · highest</option>
            <option value="createdAt:asc">Reported · oldest</option>
            <option value="updatedAt:desc">Updated · newest</option>
          </Select>
          <div className="hm-managed-complaints__filter-actions">
            <Button type="submit" variant="primary">Apply filters</Button>
            <Button
              leadingIcon={<FilterX aria-hidden="true" />}
              disabled={!hasCustomFilters}
              onClick={clearFilters}
            >
              Reset
            </Button>
          </div>
        </form>
      </Panel>

      <div className="hm-managed-complaints__result-summary" aria-live="polite">
        <strong>{loading ? "Loading queue" : `${pagination.total} complaint${pagination.total === 1 ? "" : "s"}`}</strong>
        <span>Open work is ordered by the nearest SLA deadline.</span>
      </div>

      {loading ? (
        <LoadingState label="Loading the managed complaint queue" rows={6} />
      ) : loadError ? (
        <ErrorState
          title="Complaint queue unavailable"
          description={loadError}
          onRetry={loadComplaints}
        />
      ) : complaints.length === 0 ? (
        <EmptyState
          title="No complaints match this queue"
          description="Try a broader filter, or check again when students report new maintenance work."
          action={
            <Button onClick={hasCustomFilters ? clearFilters : loadComplaints}>
              {hasCustomFilters ? "Reset filters" : "Refresh queue"}
            </Button>
          }
        />
      ) : (
        <Panel padding="none" className="hm-managed-complaints__queue">
          <ManagedComplaintQueue
            complaints={complaints}
            onAssign={setAssignmentTarget}
            onOpen={openComplaint}
          />
          <nav className="hm-complaints__pagination" aria-label="Complaint queue pagination">
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

      <ManagedComplaintDrawer
        open={Boolean(selectedId) && !assignmentTarget}
        complaint={selectedComplaint}
        attachments={attachments}
        loading={detailLoading}
        error={detailError}
        onAssign={setAssignmentTarget}
        onDismiss={closeComplaint}
        onRetry={loadSelectedComplaint}
      />

      <ComplaintAssignmentDialog
        complaint={assignmentTarget}
        onAssigned={finishAssignment}
        onDismiss={() => setAssignmentTarget(null)}
      />
    </div>
  );
};

export default AllComplaintsAdmin;
