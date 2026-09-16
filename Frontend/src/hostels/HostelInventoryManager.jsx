import { useCallback, useEffect, useState } from "react";
import { BedDouble, Boxes, Pencil, Plus, X } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  ConfirmationDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  StatusBadge,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  changeHostelBlockStatus,
  changeHostelRoomStatus,
  createHostelBlock,
  createHostelRoom,
  getHostelInventory,
  updateHostelBlock,
  updateHostelRoom,
} from "./hostelApi.js";
import { validateBlockForm, validateRoomForm } from "./hostelView.js";

const EMPTY_BLOCK = Object.freeze({ code: "", name: "" });
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
  const [blockDialog, setBlockDialog] = useState(null);
  const [blockForm, setBlockForm] = useState(EMPTY_BLOCK);
  const [blockErrors, setBlockErrors] = useState({});
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
      setError(
        getApiErrorMessage(requestError, "Could not load blocks and rooms.")
      );
    } finally {
      setLoading(false);
    }
  }, [hostel.id]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const openBlockForm = (block = null) => {
    setBlockDialog(block ?? { id: null });
    setBlockForm(
      block ? { code: block.code, name: block.name } : EMPTY_BLOCK
    );
    setBlockErrors({});
  };

  const openRoomForm = (block, room = null) => {
    setRoomDialog({ block, room });
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

  const saveBlock = async (event) => {
    event.preventDefault();
    const errors = validateBlockForm(blockForm);
    setBlockErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      if (blockDialog.id) {
        await updateHostelBlock(hostel.id, blockDialog.id, {
          name: blockForm.name.trim(),
        });
      } else {
        await createHostelBlock(hostel.id, {
          code: blockForm.code.trim().toUpperCase(),
          name: blockForm.name.trim(),
        });
      }
      setBlockDialog(null);
      await loadInventory();
      showToast({
        tone: "success",
        title: blockDialog.id ? "Block updated" : "Block created",
        message: `${hostel.code}-${blockForm.code.trim().toUpperCase()}`,
      });
    } catch (requestError) {
      showToast({
        tone: "danger",
        title: "Block was not saved",
        message: getApiErrorMessage(requestError, "Try again."),
      });
    } finally {
      setSaving(false);
    }
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
      if (roomDialog.room) {
        await updateHostelRoom(hostel.id, roomDialog.room.id, values);
      } else {
        await createHostelRoom(hostel.id, roomDialog.block.id, {
          ...values,
          roomNumber: roomForm.roomNumber.trim().toUpperCase(),
        });
      }
      setRoomDialog(null);
      await loadInventory();
      showToast({
        tone: "success",
        title: roomDialog.room ? "Room updated" : "Room created",
        message: `${roomDialog.block.code}-${roomForm.roomNumber.trim().toUpperCase()}`,
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
    const nextStatus = !statusTarget.item.isActive;
    setSaving(true);
    try {
      if (statusTarget.kind === "block") {
        await changeHostelBlockStatus(
          hostel.id,
          statusTarget.item.id,
          nextStatus
        );
      } else {
        await changeHostelRoomStatus(
          hostel.id,
          statusTarget.item.id,
          nextStatus
        );
      }
      setStatusTarget(null);
      await loadInventory();
      showToast({
        tone: "success",
        title: `${statusTarget.kind === "block" ? "Block" : "Room"} ${
          nextStatus ? "activated" : "deactivated"
        }`,
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
          <h2 id="inventory-title">Blocks and rooms</h2>
          <p>{hostel.name}</p>
        </div>
        <div className="hm-inventory__heading-actions">
          <Button
            leadingIcon={<Plus aria-hidden="true" />}
            disabled={!hostel.isActive}
            onClick={() => openBlockForm()}
          >
            Add block
          </Button>
          <Button
            variant="quiet"
            size="icon"
            aria-label="Close block and room setup"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </header>

      {loading && !inventory ? (
        <LoadingState label="Loading blocks and rooms" rows={4} />
      ) : error && !inventory ? (
        <ErrorState description={error} onRetry={loadInventory} />
      ) : inventory?.blocks.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No blocks configured"
          description="Add a block first, then create the rooms inside it."
          action={
            hostel.isActive ? (
              <Button onClick={() => openBlockForm()}>Add block</Button>
            ) : null
          }
        />
      ) : (
        <div className="hm-inventory__blocks">
          {inventory?.blocks.map((block) => (
            <Panel key={block.id} padding="none" className="hm-inventory__block">
              <header className="hm-inventory__block-heading">
                <div>
                  <span>{hostel.code}-{block.code}</span>
                  <h3>{block.name}</h3>
                  <p>{block.rooms.length} room{block.rooms.length === 1 ? "" : "s"}</p>
                </div>
                <div className="hm-inventory__block-actions">
                  <InventoryStatus active={block.isActive} />
                  <Button
                    variant="quiet"
                    leadingIcon={<Pencil aria-hidden="true" />}
                    onClick={() => openBlockForm(block)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => setStatusTarget({ kind: "block", item: block })}
                  >
                    {block.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    leadingIcon={<Plus aria-hidden="true" />}
                    disabled={!hostel.isActive || !block.isActive}
                    onClick={() => openRoomForm(block)}
                  >
                    Add room
                  </Button>
                </div>
              </header>

              {block.rooms.length === 0 ? (
                <div className="hm-inventory__empty-rooms">
                  <BedDouble aria-hidden="true" />
                  <span>No rooms in this block yet.</span>
                </div>
              ) : (
                <div className="hm-inventory__rooms">
                  {block.rooms.map((room) => (
                    <article key={room.id} className="hm-inventory__room">
                      <div className="hm-inventory__room-name">
                        <strong>{block.code}-{room.roomNumber}</strong>
                        <span>Floor {room.floor}</span>
                      </div>
                      <div>
                        <strong>{room.occupancy}/{room.capacity}</strong>
                        <span>Occupied beds</span>
                      </div>
                      <InventoryStatus active={room.isActive} />
                      <div className="hm-inventory__room-actions">
                        <Button
                          variant="quiet"
                          onClick={() => openRoomForm(block, room)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="quiet"
                          onClick={() =>
                            setStatusTarget({ kind: "room", item: room, block })
                          }
                        >
                          {room.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}

      {error && inventory && (
        <div className="hm-inventory__notice" role="alert">
          <div>
            <strong>Inventory could not be refreshed.</strong>
            <span>{error}</span>
          </div>
          <Button onClick={loadInventory}>Try again</Button>
        </div>
      )}

      <Dialog
        open={Boolean(blockDialog)}
        title={blockDialog?.id ? "Edit block" : "Add block"}
        description="Block codes are permanent after creation."
        dismissDisabled={saving}
        onDismiss={() => !saving && setBlockDialog(null)}
        footer={
          <>
            <Button disabled={saving} onClick={() => setBlockDialog(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="block-form"
              variant="primary"
              loading={saving}
              loadingLabel="Saving"
            >
              Save block
            </Button>
          </>
        }
      >
        <form id="block-form" className="hm-hostel-form" onSubmit={saveBlock}>
          <Input
            label="Block code"
            required
            disabled={Boolean(blockDialog?.id)}
            value={blockForm.code}
            error={blockErrors.code}
            hint="For example A, B, or EAST"
            onChange={(event) =>
              setBlockForm({ ...blockForm, code: event.target.value })
            }
          />
          <Input
            label="Block name"
            required
            value={blockForm.name}
            error={blockErrors.name}
            placeholder="Ashoka Block"
            onChange={(event) =>
              setBlockForm({ ...blockForm, name: event.target.value })
            }
          />
        </form>
      </Dialog>

      <Dialog
        open={Boolean(roomDialog)}
        title={roomDialog?.room ? "Edit room" : "Add room"}
        description={
          roomDialog
            ? `${hostel.code}-${roomDialog.block.code}. Room numbers are permanent after creation.`
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
            disabled={Boolean(roomDialog?.room)}
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
              roomDialog?.room
                ? `Current occupancy: ${roomDialog.room.occupancy}`
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
        title={`${statusTarget?.item.isActive ? "Deactivate" : "Activate"} ${
          statusTarget?.kind ?? "item"
        }?`}
        description={
          statusTarget?.item.isActive
            ? "Deactivation is blocked while the selected area has current residents."
            : "The selected area will become available for room operations."
        }
        confirmLabel={statusTarget?.item.isActive ? "Deactivate" : "Activate"}
        tone={statusTarget?.item.isActive ? "danger" : "default"}
        loading={saving}
        onConfirm={changeStatus}
        onDismiss={() => !saving && setStatusTarget(null)}
      />
    </section>
  );
};
