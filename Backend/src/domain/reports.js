export const REPORT_TYPES = Object.freeze({
  COMPLAINTS: "complaints",
  LEAVES: "leaves",
  GATE: "gate",
  MESS: "mess",
});

export const REPORT_PERIOD_DAYS = 30;
export const REPORT_MAX_PERIOD_DAYS = 366;

export const REPORT_DEFINITIONS = Object.freeze({
  [REPORT_TYPES.COMPLAINTS]: Object.freeze({
    period: "Complaints created within the selected inclusive timestamp range.",
    open: "Complaints whose current status is not closed.",
    currentSlaBreach: "Open complaints whose SLA deadline is earlier than report generation time.",
    firstResolution: "Time from complaint creation to its first resolved event.",
    resolutionCompliance: "First-resolved complaints whose first resolved event occurred on or before the SLA deadline.",
    reopened: "Reopened events recorded for the selected complaints.",
  }),
  [REPORT_TYPES.LEAVES]: Object.freeze({
    period: "Leave requests submitted within the selected inclusive timestamp range.",
    requestedDuration: "Time from requested departure to expected return.",
    emergency: "Leave requests submitted with the emergency indicator.",
  }),
  [REPORT_TYPES.GATE]: Object.freeze({
    period: "Gate movements recorded within the selected inclusive timestamp range.",
    movement: "Exit and return counts use persisted successful gate movement events.",
    override: "Movements whose persisted verification method is override.",
  }),
  [REPORT_TYPES.MESS]: Object.freeze({
    period: "Ratings for menu dates within the selected inclusive UTC calendar-date range.",
    average: "Arithmetic mean of persisted ratings; null means no ratings were submitted.",
    response: "One valid student rating for one menu and meal type.",
  }),
});
