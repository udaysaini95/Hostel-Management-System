import { useCallback, useEffect, useState } from "react";
import { BedDouble, Plus, X } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  ConfirmationDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  StatusBadge,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  changeHostelRoomStatus,
  createHostelRoom,
  getHostelInventory,
  updateHostelRoom,
} from "./hostelApi.js";
import { validateRoomForm } from "./hostelView.js";

const EMPTY_ROOM = Object.freeze({ roomNumber: "", floor: "0", capacity: "2" });

const InventoryStatus = ({ active }) => (
  <StatusBadge status={active ? "active" : "inactive"}>
    {active ? "Active" : "Inactive"}
  </StatusBadge>
);

export const HostelInventoryManager = ({ hostel, onClose }) => {
  const { showToast } = useToast();
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roomDialog, setRoomDialog] = useState(null);
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM);
  const [roomErrors, setRoomErrors] = useState({});
  const [statusTarget, setStatusTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInventory(await getHostelInventory(hostel.id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not load rooms."));
    } finally {
      setLoading(false);
    }
  }, [hostel.id]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const openRoomForm = (room = null) => {
    setRoomDialog(room ?? { id: null });
    setRoomForm(
      room
        ? {
            roomNumber: room.roomNumber,
            floor: String(room.floor),
            capacity: String(room.capacity),
          }
        : EMPTY_ROOM
    );
    setRoomErrors({});
  };

  const saveRoom = async (event) => {
    event.preventDefault();
    const errors = validateRoomForm(roomForm);
    setRoomErrors(errors);
    if (Object.keys(errors).length) return;

    const values = {
      floor: Number(roomForm.floor),
      capacity: Number(roomForm.capacity),
    };
    setSaving(true);
    try {
      if (roomDialog.id) {
        await updateHostelRoom(hostel.id, roomDialog.id, values);
      } else {
        await createHostelRoom(hostel.id, {
          ...values,
          roomNumber: roomForm.roomNumber.trim().toUpperCase(),
        });
      }
      setRoomDialog(null);
      await loadInventory();
      showToast({
        tone: "success",
        title: roomDialog.id ? "Room updated" : "Room created",
        message: `Room ${roomForm.roomNumber.trim().toUpperCase()} in ${hostel.code}`,
      });
    } catch (requestError) {
      showToast({
        tone: "danger",
        title: "Room was not saved",
        message: getApiErrorMessage(requestError, "Try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    const nextStatus = !statusTarget.isActive;
    setSaving(true);
    try {
      await changeHostelRoomStatus(hostel.id, statusTarget.id, nextStatus);
      setStatusTarget(null);
      await loadInventory();
      showToast({
        tone: "success",
        title: `Room ${nextStatus ? "activated" : "deactivated"}`,
      });
    } catch (requestError) {
      showToast({
        tone: "danger",
        title: "Status was not changed",
        message: getApiErrorMessage(requestError, "Try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="hm-inventory" aria-labelledby="inventory-title">
      <header className="hm-inventory__heading">
        <div>
          <span>{hostel.code}</span>
          <h2 id="inventory-title">Rooms</h2>
          <p>{hostel.name}</p>
        </div>
        <div className="hm-inventory__heading-actions">
          <Button
            leadingIcon={<Plus aria-hidden="true" />}
            disabled={!hostel.isActive}
            onClick={() => openRoomForm()}
          >
            Add room
          </Button>
          <Button
            variant="quiet"
            size="icon"
            aria-label="Close room setup"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </header>

      {loading && !inventory ? (
        <LoadingState label="Loading rooms" rows={4} />
      ) : error && !inventory ? (
        <ErrorState description={error} onRetry={loadInventory} />
      ) : inventory?.rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms configured"
          description="Add the first room to this hostel."
          action={
            hostel.isActive ? (
              <Button onClick={() => openRoomForm()}>Add room</Button>
            ) : null
          }
        />
      ) : (
        <div className="hm-inventory__rooms">
          {inventory?.rooms.map((room) => (
            <article key={room.id} className="hm-inventory__room">
              <div className="hm-inventory__room-name">
                <strong>{room.roomNumber}</strong>
                <span>Floor {room.floor}</span>
              </div>
              <div>
                <strong>
                  {room.occupancy}/{room.capacity}
                </strong>
                <span>Occupied beds</span>
              </div>
              <InventoryStatus active={room.isActive} />
              <div className="hm-inventory__room-actions">
                <Button variant="quiet" onClick={() => openRoomForm(room)}>
                  Edit
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => setStatusTarget(room)}
                >
                  {room.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {error && inventory && (
        <div className="hm-inventory__notice" role="alert">
          <div>
            <strong>Rooms could not be refreshed.</strong>
            <span>{error}</span>
          </div>
          <Button onClick={loadInventory}>Try again</Button>
        </div>
      )}

      <Dialog
        open={Boolean(roomDialog)}
        title={roomDialog?.id ? "Edit room" : "Add room"}
        description={
          roomDialog
            ? `${hostel.code}. Room numbers are permanent after creation.`
            : ""
        }
        dismissDisabled={saving}
        onDismiss={() => !saving && setRoomDialog(null)}
        footer={
          <>
            <Button disabled={saving} onClick={() => setRoomDialog(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="room-form"
              variant="primary"
              loading={saving}
              loadingLabel="Saving"
            >
              Save room
            </Button>
          </>
        }
      >
        <form id="room-form" className="hm-hostel-form" onSubmit={saveRoom}>
          <Input
            label="Room number"
            required
            disabled={Boolean(roomDialog?.id)}
            value={roomForm.roomNumber}
            error={roomErrors.roomNumber}
            placeholder="101"
            onChange={(event) =>
              setRoomForm({ ...roomForm, roomNumber: event.target.value })
            }
          />
          <Input
            label="Floor"
            type="number"
            min="0"
            max="200"
            required
            value={roomForm.floor}
            error={roomErrors.floor}
            onChange={(event) =>
              setRoomForm({ ...roomForm, floor: event.target.value })
            }
          />
          <Input
            label="Bed capacity"
            type="number"
            min="1"
            max="20"
            required
            value={roomForm.capacity}
            error={roomErrors.capacity}
            hint={
              roomDialog?.id
                ? `Current occupancy: ${roomDialog.occupancy}`
                : "Use the actual number of beds in this room."
            }
            onChange={(event) =>
              setRoomForm({ ...roomForm, capacity: event.target.value })
            }
          />
        </form>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(statusTarget)}
        title={`${statusTarget?.isActive ? "Deactivate" : "Activate"} room?`}
        description={
          statusTarget?.isActive
            ? "Deactivation is blocked while this room has current residents."
            : "The room will become available for allocation."
        }
        confirmLabel={statusTarget?.isActive ? "Deactivate" : "Activate"}
        tone={statusTarget?.isActive ? "danger" : "default"}
        loading={saving}
        onConfirm={changeStatus}
        onDismiss={() => !saving && setStatusTarget(null)}
      />
    </section>
  );
};
