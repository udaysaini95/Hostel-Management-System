import { useRef, useState } from "react";
import { BedDouble, UsersRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios.js";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  ConfirmationDialog,
  PageHeader,
  Textarea,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import { ResidentDirectory } from "../residents/ResidentDirectory.jsx";
import { RoomAllocationDialog } from "../residents/RoomAllocationDialog.jsx";
import { RoomInventory } from "../residents/RoomInventory.jsx";

const VIEWS = Object.freeze({
  RESIDENTS: "residents",
  ROOMS: "rooms",
});

const ResidentRoomManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allocationResident, setAllocationResident] = useState(null);
  const [vacancyResident, setVacancyResident] = useState(null);
  const [vacancyReason, setVacancyReason] = useState("");
  const [vacancyReasonError, setVacancyReasonError] = useState("");
  const [vacancyError, setVacancyError] = useState("");
  const [vacating, setVacating] = useState(false);
  const residentTabRef = useRef(null);
  const roomTabRef = useRef(null);
  const residentDirectoryRef = useRef(null);
  const roomInventoryRef = useRef(null);
  const vacancyReasonRef = useRef(null);
  const { showToast } = useToast();
  const currentView =
    searchParams.get("view") === VIEWS.ROOMS ? VIEWS.ROOMS : VIEWS.RESIDENTS;

  const changeView = (view) => {
    setSearchParams(view === VIEWS.ROOMS ? { view: VIEWS.ROOMS } : {});
  };

  const handleTabKeyDown = (event, view) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextView =
      event.key === "Home"
        ? VIEWS.RESIDENTS
        : event.key === "End"
          ? VIEWS.ROOMS
          : view === VIEWS.RESIDENTS
            ? VIEWS.ROOMS
            : VIEWS.RESIDENTS;
    changeView(nextView);
    const nextTab =
      nextView === VIEWS.RESIDENTS ? residentTabRef : roomTabRef;
    window.requestAnimationFrame(() => nextTab.current?.focus());
  };

  const allocationComplete = (resident) => {
    setAllocationResident(null);
    residentDirectoryRef.current?.refresh();
    roomInventoryRef.current?.refresh();
    showToast({
      tone: "success",
      title: "Room allocated",
      message: `${resident.name} now has an active room assignment.`,
    });
  };

  const openVacancyDialog = (resident) => {
    setVacancyResident(resident);
    setVacancyReason("");
    setVacancyReasonError("");
    setVacancyError("");
  };

  const closeVacancyDialog = () => {
    if (vacating) {
      return;
    }

    setVacancyResident(null);
    setVacancyReason("");
    setVacancyReasonError("");
    setVacancyError("");
  };

  const confirmVacancy = async () => {
    const reason = vacancyReason.trim();
    const allocationId = Number(vacancyResident?.currentAllocation?.id);

    if (reason.length < 5) {
      setVacancyReasonError(
        "Enter at least 5 characters explaining why the room is being vacated."
      );
      window.requestAnimationFrame(() => vacancyReasonRef.current?.focus());
      return;
    }
    if (!Number.isSafeInteger(allocationId) || allocationId < 1) {
      setVacancyError(
        "This allocation is missing its reference. Refresh the resident list and try again."
      );
      return;
    }

    try {
      setVacating(true);
      setVacancyError("");
      await api.patch(`/api/room-allocations/${allocationId}/vacate`, {
        reason,
      });
      const residentName = vacancyResident.name;
      setVacancyResident(null);
      setVacancyReason("");
      residentDirectoryRef.current?.refresh();
      roomInventoryRef.current?.refresh();
      showToast({
        tone: "success",
        title: "Room vacated",
        message: `${residentName}'s previous allocation remains in room history.`,
      });
    } catch (error) {
      setVacancyError(
        getApiErrorMessage(error, "The room allocation could not be vacated.")
      );
    } finally {
      setVacating(false);
    }
  };

  const actionPending = Boolean(allocationResident || vacancyResident);

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-residents">
      <PageHeader
        eyebrow="Resident operations"
        title="Residents and rooms"
        description="Find residents, manage current room assignments, and review live room occupancy within your hostel access."
      />

      <div className="hm-residents__tabs" role="tablist" aria-label="Resident and room views">
        <button
          ref={residentTabRef}
          id="resident-directory-tab"
          type="button"
          role="tab"
          aria-selected={currentView === VIEWS.RESIDENTS}
          aria-controls="resident-directory-panel"
          onClick={() => changeView(VIEWS.RESIDENTS)}
          onKeyDown={(event) => handleTabKeyDown(event, VIEWS.RESIDENTS)}
        >
          <UsersRound aria-hidden="true" />
          Residents
        </button>
        <button
          ref={roomTabRef}
          id="room-inventory-tab"
          type="button"
          role="tab"
          aria-selected={currentView === VIEWS.ROOMS}
          aria-controls="room-inventory-panel"
          onClick={() => changeView(VIEWS.ROOMS)}
          onKeyDown={(event) => handleTabKeyDown(event, VIEWS.ROOMS)}
        >
          <BedDouble aria-hidden="true" />
          Room inventory
        </button>
      </div>

      <ResidentDirectory
        ref={residentDirectoryRef}
        active={currentView === VIEWS.RESIDENTS}
        actionPending={actionPending}
        onAllocate={setAllocationResident}
        onVacate={openVacancyDialog}
      />
      <RoomInventory
        ref={roomInventoryRef}
        active={currentView === VIEWS.ROOMS}
      />

      <RoomAllocationDialog
        open={Boolean(allocationResident)}
        resident={allocationResident}
        onDismiss={() => setAllocationResident(null)}
        onAllocated={allocationComplete}
      />

      <ConfirmationDialog
        open={Boolean(vacancyResident)}
        title="Vacate this room?"
        description={
          vacancyResident
            ? `${vacancyResident.name} will no longer be assigned to ${vacancyResident.currentAllocation?.room.label}. The allocation remains in history.`
            : undefined
        }
        confirmLabel="Vacate room"
        loadingLabel="Vacating room"
        tone="danger"
        loading={vacating}
        onConfirm={confirmVacancy}
        onDismiss={closeVacancyDialog}
      >
        <div className="hm-residents__vacancy-form">
          <Textarea
            ref={vacancyReasonRef}
            data-autofocus
            label="Reason for vacancy"
            name="vacateReason"
            maxLength={500}
            required
            placeholder="Example: Resident completed approved checkout"
            value={vacancyReason}
            error={vacancyReasonError}
            onChange={(event) => {
              setVacancyReason(event.target.value);
              setVacancyReasonError("");
              setVacancyError("");
            }}
          />
          {vacancyError && (
            <p className="hm-residents__form-error" role="alert">
              {vacancyError}
            </p>
          )}
        </div>
      </ConfirmationDialog>
    </div>
  );
};

export default ResidentRoomManagement;
