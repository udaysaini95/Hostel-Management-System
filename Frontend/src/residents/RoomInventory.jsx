import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { BedDouble } from "lucide-react";
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
  EMPTY_PAGINATION,
  hasActiveFilter,
  normalizeRoomFilters,
} from "./residentView.js";

const EMPTY_FILTERS = Object.freeze({
  hostelCode: "",
  blockCode: "",
  availability: "all",
});

const Availability = ({ room }) => (
  <span className="hm-residents__availability">
    <Badge tone={room.isFull ? "neutral" : "success"}>
      {room.isFull ? "Full" : "Available"}
    </Badge>
    <small>
      {room.occupancy} of {room.capacity} beds occupied
    </small>
  </span>
);

export const RoomInventory = forwardRef(function RoomInventory(
  { active },
  ref
) {
  const [roomList, setRoomList] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const loadRooms = useCallback(async () => {
    if (!active) {
      return;
    }

    const requestNumber = latestRequest.current + 1;
    latestRequest.current = requestNumber;

    try {
      setLoading(true);
      setError("");
      const response = await api.get("/api/rooms", {
        params: {
          page,
          pageSize: EMPTY_PAGINATION.pageSize,
          hostelCode: filters.hostelCode || undefined,
          blockCode: filters.blockCode || undefined,
          availability: filters.availability,
        },
      });

      if (requestNumber !== latestRequest.current) {
        return;
      }

      const nextPagination = response.data?.pagination ?? EMPTY_PAGINATION;
      setRoomList(Array.isArray(response.data?.data) ? response.data.data : []);
      setPagination(nextPagination);

      if (nextPagination.totalPages > 0 && page > nextPagination.totalPages) {
        setPage(nextPagination.totalPages);
      }
    } catch (requestError) {
      if (requestNumber === latestRequest.current) {
        setError(
          getApiErrorMessage(requestError, "Room inventory could not be loaded.")
        );
      }
    } finally {
      if (requestNumber === latestRequest.current) {
        setLoading(false);
      }
    }
  }, [active, filters, page]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useImperativeHandle(ref, () => ({ refresh: loadRooms }), [loadRooms]);

  const updateDraft = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setFilters(normalizeRoomFilters(draftFilters));
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
      id="room-inventory-panel"
      role="tabpanel"
      aria-labelledby="room-inventory-tab"
      className="hm-residents__view"
      hidden={!active}
    >
      <Panel as="form" className="hm-residents__filters hm-residents__filters--rooms" onSubmit={applyFilters}>
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
        <Select
          label="Availability"
          name="availability"
          value={draftFilters.availability}
          onChange={(event) => updateDraft("availability", event.target.value)}
        >
          <option value="all">All rooms</option>
          <option value="available">Available beds</option>
          <option value="full">Full rooms</option>
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

      {loading && roomList.length > 0 && (
        <p className="hm-residents__refreshing" role="status">
          Updating room inventory…
        </p>
      )}

      {error && roomList.length > 0 && (
        <div className="hm-residents__notice" role="alert">
          <div>
            <strong>Room inventory could not be refreshed.</strong>
            <span>{error}</span>
          </div>
          <Button onClick={loadRooms}>Try again</Button>
        </div>
      )}

      {loading && roomList.length === 0 ? (
        <LoadingState label="Loading room inventory" rows={5} />
      ) : error && roomList.length === 0 ? (
        <ErrorState
          title="Room inventory unavailable"
          description={error}
          onRetry={loadRooms}
        />
      ) : roomList.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title={filtersActive ? "No matching rooms" : "No active rooms"}
          description={
            filtersActive
              ? "No rooms match the applied hostel, block, and availability filters."
              : "Active rooms will appear here after hostel setup is complete."
          }
          action={
            filtersActive ? <Button onClick={clearFilters}>Clear filters</Button> : null
          }
        />
      ) : (
        <div className="hm-residents__results">
          <div className="hm-residents__results-heading">
            <div>
              <h2>Room inventory</h2>
              <p>Occupancy counts include only current allocations.</p>
            </div>
            <Badge tone="neutral">{pagination.total} rooms</Badge>
          </div>

          <div className="hm-residents__desktop-list">
            <Table caption="Room inventory" hideCaption>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Room</TableHeaderCell>
                  <TableHeaderCell>Hostel</TableHeaderCell>
                  <TableHeaderCell>Block</TableHeaderCell>
                  <TableHeaderCell className="hm-table__numeric">
                    Floor
                  </TableHeaderCell>
                  <TableHeaderCell>Availability</TableHeaderCell>
                  <TableHeaderCell className="hm-table__numeric">
                    Open beds
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roomList.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell>
                      <strong className="hm-residents__entity-name hm-residents__mono">
                        {room.label}
                      </strong>
                    </TableCell>
                    <TableCell>
                      <strong>{room.hostel.code}</strong>
                      <span className="hm-residents__entity-meta">
                        {room.hostel.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <strong>{room.block.code}</strong>
                      <span className="hm-residents__entity-meta">
                        {room.block.name}
                      </span>
                    </TableCell>
                    <TableCell numeric>{room.floor}</TableCell>
                    <TableCell>
                      <Availability room={room} />
                    </TableCell>
                    <TableCell numeric>{room.availableBeds}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="hm-residents__mobile-list">
            {roomList.map((room) => (
              <Panel
                as="article"
                padding="compact"
                className="hm-residents__record"
                key={room.id}
              >
                <div className="hm-residents__record-heading">
                  <div>
                    <h3 className="hm-residents__mono">{room.label}</h3>
                    <p>{room.hostel.code} — {room.block.name}</p>
                  </div>
                  <Badge tone={room.isFull ? "neutral" : "success"}>
                    {room.isFull ? "Full" : "Available"}
                  </Badge>
                </div>
                <dl className="hm-residents__record-details">
                  <div>
                    <dt>Floor</dt>
                    <dd>{room.floor}</dd>
                  </div>
                  <div>
                    <dt>Capacity</dt>
                    <dd>{room.capacity} beds</dd>
                  </div>
                  <div>
                    <dt>Occupied</dt>
                    <dd>{room.occupancy}</dd>
                  </div>
                  <div>
                    <dt>Open beds</dt>
                    <dd>{room.availableBeds}</dd>
                  </div>
                </dl>
              </Panel>
            ))}
          </div>

          <PaginationControls
            pagination={pagination}
            disabled={loading}
            label="Room inventory pagination"
            onPageChange={setPage}
          />
        </div>
      )}
    </section>
  );
});
