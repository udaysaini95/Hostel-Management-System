import { formatLeaveDateTime } from "./leaveView.js";

export const formatLeaveRange = (leave) =>
  `${formatLeaveDateTime(leave.departureAt)} – ${formatLeaveDateTime(
    leave.expectedReturnAt
  )}`;

export const validateDecisionNote = (note) => {
  const cleanNote = note.trim();

  if (cleanNote.length < 5) {
    return "Enter a decision note with at least 5 characters.";
  }
  if (cleanNote.length > 1000) {
    return "Decision note must not exceed 1000 characters.";
  }

  return "";
};

export const getReviewWarning = (leave) => {
  const activeRequests = leave?.reviewWarnings?.activeRequests ?? [];
  const overlappingRequest = activeRequests.find(
    (request) => request.overlapsSchedule
  );

  if (overlappingRequest) {
    return {
      tone: "danger",
      blocksApproval: true,
      title: "Overlapping active leave detected",
      message: `Request #${overlappingRequest.id} overlaps this schedule. Resolve the conflict before approval.`,
    };
  }
  if (activeRequests.length > 0) {
    return {
      tone: "warning",
      blocksApproval: false,
      title: "Student has another active leave",
      message: `Review request #${activeRequests[0].id} before making this decision. The schedules do not overlap.`,
    };
  }

  return null;
};
