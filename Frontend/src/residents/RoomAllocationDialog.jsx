import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios.js";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "../components/ui/index.js";
import { PaginationControls } from "./PaginationControls.jsx";
import { EMPTY_PAGINATION } from "./residentView.js";

const ROOM_PAGE_SIZE = 20;

export const RoomAllocationDialog = ({
  open,
  resident,
  onDismiss,
  onAllocated,
}) => {
  const [rooms, setRooms] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [blockInput, setBlockInput] = useState("");
  const [blockCode, setBlockCode] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const latestRequest = useRef(0);
  const roomSelectRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPage(1);
    setBlockInput("");
    setBlockCode("");
    setSelectedRoomId("");
    setSelectionError("");
    setActionError("");
  }, [open, resident?.userId]);

  const loadRooms = useCallback(async () => {
    if (!open || !resident) {
      return;
    }

    const requestNumber = latestRequest.current + 1;
    latestRequest.current = requestNumber;

    try {
      setLoading(true);
      setLoadError("");
      setSelectedRoomId("");
      const response = await api.get("/api/rooms", {
        params: {
          page,
          pageSize: ROOM_PAGE_SIZE,
          hostelCode: resident.hostel.code,
          blockCode: blockCode || undefined,
          availability: "available",
        },
      });

      if (requestNumber !== latestRequest.current) {
        return;
      }

      const nextPagination = response.data?.pagination ?? EMPTY_PAGINATION;
      setRooms(Array.isArray(response.data?.data) ? response.data.data : []);
      setPagination(nextPagination);

      if (nextPagination.totalPages > 0 && page > nextPagination.totalPages) {
        setPage(nextPagination.totalPages);
      }
    } catch (error) {
      if (requestNumber === latestRequest.current) {
        setRooms([]);
        setLoadError(
          getApiErrorMessage(error, "Available rooms could not be loaded.")
        );
      }
    } finally {
      if (requestNumber === latestRequest.current) {
        setLoading(false);
      }
    }
  }, [blockCode, open, page, resident]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const filterRooms = (event) => {
    event.preventDefault();
    setBlockCode(blockInput.trim().toUpperCase());
    setPage(1);
  };

  const allocate = async () => {
    const roomId = Number(selectedRoomId);

    if (!Number.isSafeInteger(roomId) || roomId < 1) {
      setSelectionError("Select an available room.");
      window.requestAnimationFrame(() => roomSelectRef.current?.focus());
      return;
    }

    try {
      setSaving(true);
      setActionError("");
      await api.post("/api/room-allocations", {
        studentUserId: resident.userId,
        roomId,
      });
      onAllocated(resident);
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "The room could not be allocated.")
      );

      if (error?.response?.data?.code === "ROOM_CAPACITY_REACHED") {
        await loadRooms();
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedRoom = rooms.find((room) => room.id === Number(selectedRoomId));

  return (
    <Dialog
      open={open}
      title="Allocate room"
      description={
        resident
          ? `Choose an available room in ${resident.hostel.code} for ${resident.name} (${resident.rollNo}).`
          : undefined
      }
      dismissDisabled={saving}
      onDismiss={saving ? () => {} : onDismiss}
      footer={
        <>
          <Button onClick={onDismiss} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            loadingLabel="Allocating room"
            disabled={loading || rooms.length === 0}
            onClick={allocate}
          >
            Allocate room
          </Button>
        </>
      }
    >
      <div className="hm-residents__allocation-form">
        <form className="hm-residents__room-filter" onSubmit={filterRooms}>
          <Input
            label="Block code"
            name="allocationBlockCode"
            maxLength={20}
            pattern="[A-Za-z][A-Za-z0-9-]*"
            title="Start with a letter and use only letters, numbers, or hyphens"
            placeholder="All blocks"
            hint="Optional. Leave blank to show every block in this hostel."
            value={blockInput}
            onChange={(event) => setBlockInput(event.target.value)}
          />
          <Button type="submit">Filter rooms</Button>
        </form>

        {loading ? (
          <LoadingState compact label="Loading available rooms" rows={3} />
        ) : loadError ? (
          <ErrorState
            title="Available rooms unavailable"
            description={loadError}
            onRetry={loadRooms}
          />
        ) : rooms.length === 0 ? (
          <EmptyState
            title="No available rooms"
            description={
              blockCode
                ? `No rooms with open beds were found in block ${blockCode}.`
                : `No rooms with open beds were found in ${resident?.hostel.code}.`
            }
            action={
              blockCode ? (
                <Button
                  onClick={() => {
                    setBlockInput("");
                    setBlockCode("");
                    setPage(1);
                  }}
                >
                  Show all blocks
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <Select
              ref={roomSelectRef}
              data-autofocus
              label="Available room"
              name="roomId"
              required
              value={selectedRoomId}
              error={selectionError}
              onChange={(event) => {
                setSelectedRoomId(event.target.value);
                setSelectionError("");
                setActionError("");
              }}
            >
              <option value="">Select a room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label} — floor {room.floor}, {room.availableBeds} open {room.availableBeds === 1 ? "bed" : "beds"}
                </option>
              ))}
            </Select>

            {selectedRoom && (
              <p className="hm-residents__selection-note">
                {selectedRoom.block.name}, {selectedRoom.occupancy} of {selectedRoom.capacity} beds currently occupied.
              </p>
            )}

            <PaginationControls
              pagination={pagination}
              disabled={loading}
              label="Available room pagination"
              onPageChange={setPage}
            />
          </>
        )}

        {actionError && (
          <p className="hm-residents__form-error" role="alert">
            {actionError}
          </p>
        )}
      </div>
    </Dialog>
  );
};
