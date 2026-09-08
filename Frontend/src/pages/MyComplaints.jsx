import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  Select,
} from "../components/ui/index.js";
import { ComplaintListItem } from "../complaints/ComplaintListItem.jsx";
import { getMyComplaints } from "../complaints/complaintApi.js";
import {
  COMPLAINT_STATUSES,
  getComplaintStatusLabel,
} from "../complaints/complaintView.js";

const EMPTY_PAGINATION = Object.freeze({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
});

const MyComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadComplaints = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const result = await getMyComplaints({ page, status });
      setComplaints(result?.data ?? []);
      setPagination(result?.pagination ?? EMPTY_PAGINATION);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, "Your complaints could not be loaded.")
      );
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const changeStatus = (event) => {
    setStatus(event.target.value);
    setPage(1);
  };

  return (
    <div className="hm-page-stack hm-page-stack--medium hm-complaints">
      <PageHeader
        eyebrow="Maintenance"
        title="My complaints"
        description="Track reported maintenance work, SLA status, and updates from hostel staff."
        actions={
          <ButtonLink
            to="/student/complaints/raise"
            variant="primary"
          >
            <Plus aria-hidden="true" />
            Create complaint
          </ButtonLink>
        }
      />

      <Panel className="hm-complaints__filters" padding="compact">
        <Select label="Status" value={status} onChange={changeStatus}>
          <option value="">All statuses</option>
          {COMPLAINT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {getComplaintStatusLabel(value)}
            </option>
          ))}
        </Select>
        <p aria-live="polite">
          {loading
            ? "Loading results"
            : `${pagination.total} complaint${pagination.total === 1 ? "" : "s"}`}
        </p>
      </Panel>

      {loading ? (
        <LoadingState label="Loading your complaints" rows={5} />
      ) : loadError ? (
        <ErrorState
          title="Complaints are unavailable"
          description={loadError}
          onRetry={loadComplaints}
        />
      ) : complaints.length === 0 ? (
        <EmptyState
          title={status ? "No complaints match this status" : "No complaints yet"}
          description={
            status
              ? "Choose another status to review the rest of your complaint history."
              : "Create a complaint when your room or hostel facility needs maintenance."
          }
          action={
            status ? (
              <Button onClick={() => setStatus("")}>Show all complaints</Button>
            ) : (
              <ButtonLink to="/student/complaints/raise" variant="primary">
                Create complaint
              </ButtonLink>
            )
          }
        />
      ) : (
        <Panel padding="none" className="hm-complaint-list">
          <ul>
            {complaints.map((complaint) => (
              <ComplaintListItem key={complaint.id} complaint={complaint} />
            ))}
          </ul>
          <nav
            className="hm-complaints__pagination"
            aria-label="Complaints pagination"
          >
            <span>
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <div>
              <Button
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                disabled={
                  pagination.totalPages === 0 || page >= pagination.totalPages
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
        </Panel>
      )}
    </div>
  );
};

export default MyComplaints;
