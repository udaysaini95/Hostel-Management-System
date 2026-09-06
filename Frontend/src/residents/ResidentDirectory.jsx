import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { BedDouble, Search, UsersRound } from "lucide-react";
import api from "../api/axios.js";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/ui/index.js";
import { PaginationControls } from "./PaginationControls.jsx";
import {
  ACCOUNT_STATUS_OPTIONS,
  EMPTY_PAGINATION,
  formatResidentDate,
  getAccountStatusLabel,
  getAccountStatusTone,
  hasActiveFilter,
  normalizeResidentFilters,
} from "./residentView.js";

const EMPTY_FILTERS = Object.freeze({
  search: "",
  hostelCode: "",
  blockCode: "",
  roomNumber: "",
  accountStatus: "",
});

const RoomAssignment = ({ allocation }) =>
  allocation ? (
    <span className="hm-residents__room">
      <strong>{allocation.room.label}</strong>
      <small>Since {formatResidentDate(allocation.allocatedAt)}</small>
    </span>
  ) : (
    <span className="hm-residents__muted">Not allocated</span>
  );

const ResidentAction = ({ resident, disabled, onAllocate, onVacate }) => {
  if (resident.currentAllocation) {
    return (
      <Button
        variant="danger-secondary"
        disabled={disabled}
        onClick={() => onVacate(resident)}
      >
        Vacate room
      </Button>
    );
  }

  if (resident.accountStatus !== "active") {
    return <span className="hm-residents__muted">Account not active</span>;
  }

  return (
    <Button disabled={disabled} onClick={() => onAllocate(resident)}>
      Allocate room
    </Button>
  );
};

export const ResidentDirectory = forwardRef(function ResidentDirectory(
  { active, actionPending, onAllocate, onVacate },
  ref
) {
  const [residents, setResidents] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const loadResidents = useCallback(async () => {
    if (!active) {
      return;
    }

    const requestNumber = latestRequest.current + 1;
    latestRequest.current = requestNumber;

    try {
      setLoading(true);
      setError("");
      const response = await api.get("/api/residents", {
        params: {
          page,
          pageSize: EMPTY_PAGINATION.pageSize,
          search: filters.search || undefined,
          hostelCode: filters.hostelCode || undefined,
          blockCode: filters.blockCode || undefined,
          roomNumber: filters.roomNumber || undefined,
          accountStatus: filters.accountStatus || undefined,
        },
      });

      if (requestNumber !== latestRequest.current) {
        return;
      }

      const nextPagination = response.data?.pagination ?? EMPTY_PAGINATION;
      setResidents(Array.isArray(response.data?.data) ? response.data.data : []);
      setPagination(nextPagination);

      if (nextPagination.totalPages > 0 && page > nextPagination.totalPages) {
        setPage(nextPagination.totalPages);
      }
    } catch (requestError) {
      if (requestNumber === latestRequest.current) {
        setError(
          getApiErrorMessage(
            requestError,
            "Resident records could not be loaded."
          )
        );
      }
    } finally {
      if (requestNumber === latestRequest.current) {
        setLoading(false);
      }
    }
  }, [active, filters, page]);

  useEffect(() => {
    loadResidents();
  }, [loadResidents]);

  useImperativeHandle(ref, () => ({ refresh: loadResidents }), [loadResidents]);

  const updateDraft = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setFilters(normalizeResidentFilters(draftFilters));
    setPage(1);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const filtersActive = hasActiveFilter(filters);

  return (
    <section
      id="resident-directory-panel"
      role="tabpanel"
      aria-labelledby="resident-directory-tab"
      className="hm-residents__view"
      hidden={!active}
    >
      <Panel as="form" className="hm-residents__filters" onSubmit={applyFilters}>
        <Input
          label="Search residents"
          name="search"
          type="search"
          maxLength={100}
          placeholder="Name, email, or roll number"
          startIcon={<Search />}
          value={draftFilters.search}
          onChange={(event) => updateDraft("search", event.target.value)}
        />
        <Input
          label="Hostel code"
          name="hostelCode"
          maxLength={20}
          pattern="[A-Za-z][A-Za-z0-9-]*"
          title="Start with a letter and use only letters, numbers, or hyphens"
          placeholder="H1"
          value={draftFilters.hostelCode}
          onChange={(event) => updateDraft("hostelCode", event.target.value)}
        />
        <Input
          label="Block code"
          name="blockCode"
          maxLength={20}
          pattern="[A-Za-z][A-Za-z0-9-]*"
          title="Start with a letter and use only letters, numbers, or hyphens"
          placeholder="A"
          value={draftFilters.blockCode}
          onChange={(event) => updateDraft("blockCode", event.target.value)}
        />
        <Input
          label="Room number"
          name="roomNumber"
          maxLength={20}
          pattern="[A-Za-z0-9][A-Za-z0-9-]*"
          title="Use only letters, numbers, or hyphens"
          placeholder="101"
          value={draftFilters.roomNumber}
          onChange={(event) => updateDraft("roomNumber", event.target.value)}
        />
        <Select
          label="Account state"
          name="accountStatus"
          value={draftFilters.accountStatus}
          onChange={(event) => updateDraft("accountStatus", event.target.value)}
        >
          {ACCOUNT_STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <div className="hm-residents__filter-actions">
          <Button type="submit" variant="primary">
            Apply filters
          </Button>
          {(hasActiveFilter(draftFilters) || filtersActive) && (
            <Button variant="quiet" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </Panel>

      {loading && residents.length > 0 && (
        <p className="hm-residents__refreshing" role="status">
          Updating resident records…
        </p>
      )}

      {error && residents.length > 0 && (
        <div className="hm-residents__notice" role="alert">
          <div>
            <strong>Resident records could not be refreshed.</strong>
            <span>{error}</span>
          </div>
          <Button onClick={loadResidents}>Try again</Button>
        </div>
      )}

      {loading && residents.length === 0 ? (
        <LoadingState label="Loading resident directory" rows={5} />
      ) : error && residents.length === 0 ? (
        <ErrorState
          title="Resident directory unavailable"
          description={error}
          onRetry={loadResidents}
        />
      ) : residents.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={filtersActive ? "No matching residents" : "No residents yet"}
          description={
            filtersActive
              ? "No residents match the applied search and filters."
              : "Activated student profiles will appear here."
          }
          action={
            filtersActive ? <Button onClick={clearFilters}>Clear filters</Button> : null
          }
        />
      ) : (
        <div className="hm-residents__results">
          <div className="hm-residents__results-heading">
            <div>
              <h2>Resident directory</h2>
              <p>Room actions use the student's assigned hostel.</p>
            </div>
            <Badge tone="neutral">{pagination.total} residents</Badge>
          </div>

          <div className="hm-residents__desktop-list">
            <Table caption="Resident directory" hideCaption>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Student</TableHeaderCell>
                  <TableHeaderCell>Hostel</TableHeaderCell>
                  <TableHeaderCell>Profile</TableHeaderCell>
                  <TableHeaderCell>Current room</TableHeaderCell>
                  <TableHeaderCell>Account</TableHeaderCell>
                  <TableHeaderCell className="hm-table__actions">
                    Action
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {residents.map((resident) => (
                  <TableRow key={resident.userId}>
                    <TableCell>
                      <strong className="hm-residents__entity-name">
                        {resident.name}
                      </strong>
                      <span className="hm-residents__entity-meta">
                        {resident.email}
                      </span>
                      <span className="hm-residents__entity-meta hm-residents__mono">
                        {resident.rollNo}
                      </span>
                    </TableCell>
                    <TableCell>
                      <strong>{resident.hostel.code}</strong>
                      <span className="hm-residents__entity-meta">
                        {resident.hostel.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge tone={resident.profileComplete ? "success" : "warning"}>
                        {resident.profileComplete ? "Complete" : "Needs details"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RoomAssignment allocation={resident.currentAllocation} />
                    </TableCell>
                    <TableCell>
                      <Badge tone={getAccountStatusTone(resident.accountStatus)}>
                        {getAccountStatusLabel(resident.accountStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell actions>
                      <ResidentAction
                        resident={resident}
                        disabled={actionPending}
                        onAllocate={onAllocate}
                        onVacate={onVacate}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="hm-residents__mobile-list">
            {residents.map((resident) => (
              <Panel
                as="article"
                padding="compact"
                className="hm-residents__record"
                key={resident.userId}
              >
                <div className="hm-residents__record-heading">
                  <div>
                    <h3>{resident.name}</h3>
                    <p className="hm-residents__mono">{resident.rollNo}</p>
                  </div>
                  <Badge tone={getAccountStatusTone(resident.accountStatus)}>
                    {getAccountStatusLabel(resident.accountStatus)}
                  </Badge>
                </div>
                <dl className="hm-residents__record-details">
                  <div>
                    <dt>Hostel</dt>
                    <dd>{resident.hostel.code} — {resident.hostel.name}</dd>
                  </div>
                  <div>
                    <dt>Room</dt>
                    <dd>
                      {resident.currentAllocation
                        ? resident.currentAllocation.room.label
                        : "Not allocated"}
                    </dd>
                  </div>
                  <div>
                    <dt>Profile</dt>
                    <dd>
                      {resident.profileComplete ? "Complete" : "Needs details"}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{resident.email}</dd>
                  </div>
                </dl>
                <ResidentAction
                  resident={resident}
                  disabled={actionPending}
                  onAllocate={onAllocate}
                  onVacate={onVacate}
                />
              </Panel>
            ))}
          </div>

          <PaginationControls
            pagination={pagination}
            disabled={loading}
            label="Resident directory pagination"
            onPageChange={setPage}
          />
        </div>
      )}
    </section>
  );
});
