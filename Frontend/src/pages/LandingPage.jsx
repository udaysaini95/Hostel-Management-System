import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleUserRound,
  DoorOpen,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { ButtonLink } from "../components/ui";

const operationalRecords = [
  {
    id: "CMP-1042",
    record: "Electrical repair",
    location: "H1 · Room B-214",
    owner: "Maintenance",
    status: "Assigned",
    tone: "brand",
  },
  {
    id: "LEV-0381",
    record: "Weekend leave",
    location: "H2 · Resident 221",
    owner: "Warden",
    status: "Approved",
    tone: "success",
  },
  {
    id: "GAT-8294",
    record: "Campus return",
    location: "Main gate · 20:42",
    owner: "Gate desk",
    status: "Recorded",
    tone: "neutral",
  },
];

const roleWorkspaces = {
  student: {
    label: "Student",
    eyebrow: "Resident workspace",
    title: "Everything about hostel life, in one place.",
    description:
      "A resident can raise a complaint, request leave, open an approved gate pass, check the menu, and follow every update.",
    navigation: ["Overview", "Complaints", "Leave & pass", "Mess"],
    activeNavigation: "Overview",
    panelTitle: "Your hostel today",
    panelMeta: "H1 · North Residence",
    rows: [
      ["Plumbing complaint", "Assigned"],
      ["Weekend leave", "Pass ready"],
      ["Dinner", "Dal, rice and seasonal vegetables"],
    ],
  },
  warden: {
    label: "Warden",
    eyebrow: "Operations workspace",
    title: "Priorities are visible before they become problems.",
    description:
      "Wardens see only their assigned hostels, with pending leave, complaint SLA, room, gate, mess, and notice work together.",
    navigation: ["Overview", "Residents", "Complaints", "Leave requests"],
    activeNavigation: "Complaints",
    panelTitle: "Complaint queue",
    panelMeta: "H1 · Ordered by attention needed",
    rows: [
      ["CMP-1042 · Electrical", "SLA due soon"],
      ["CMP-1038 · Plumbing", "In progress"],
      ["CMP-1029 · Furniture", "Awaiting verification"],
    ],
  },
  maintenance: {
    label: "Maintenance",
    eyebrow: "Work-order workspace",
    title: "Assigned work arrives with the context to act.",
    description:
      "Technicians receive scoped work orders with location, priority, evidence, SLA status, and a permanent update timeline.",
    navigation: ["Overview", "My work orders", "Notices"],
    activeNavigation: "My work orders",
    panelTitle: "Assigned work",
    panelMeta: "2 require an update",
    rows: [
      ["Room B-214 · Electrical", "Start work"],
      ["Second floor · Plumbing", "In progress"],
      ["Study hall · Furniture", "Add resolution"],
    ],
  },
  gate: {
    label: "Gate security",
    eyebrow: "Verification workspace",
    title: "One clear decision at the gate.",
    description:
      "Gate staff verify the current pass state, record the permitted exit or return once, and retain a reliable movement history.",
    navigation: ["Gate terminal", "Outside roster", "Movement history"],
    activeNavigation: "Gate terminal",
    panelTitle: "Pass verified",
    panelMeta: "H2 · Main gate",
    rows: [
      ["Resident", "Ananya Rao · 2026 CSE 042"],
      ["Expected return", "10 Sep · 21:30"],
      ["Permitted action", "Record return"],
    ],
  },
};

const complaintSteps = [
  ["01", "Student reports", "Location, description and optional evidence"],
  ["02", "Warden assigns", "Priority, ownership and SLA stay visible"],
  ["03", "Staff resolves", "Work notes and resolution evidence are recorded"],
  ["04", "Student verifies", "Close the issue or reopen it with a reason"],
];

const leaveSteps = [
  "Leave requested",
  "Warden decision",
  "Pass issued",
  "Exit recorded",
  "Return recorded",
];

const RoleWorkspace = () => {
  const [activeRole, setActiveRole] = useState("student");
  const workspace = roleWorkspaces[activeRole];
  const roleKeys = Object.keys(roleWorkspaces);

  const handleRoleKeyDown = (event, currentRole) => {
    const currentIndex = roleKeys.indexOf(currentRole);
    let nextIndex;

    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      nextIndex = (currentIndex + 1) % roleKeys.length;
    } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      nextIndex = (currentIndex - 1 + roleKeys.length) % roleKeys.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = roleKeys.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextRole = roleKeys[nextIndex];
    setActiveRole(nextRole);
    event.currentTarget.parentElement
      ?.querySelector(`#role-tab-${nextRole}`)
      ?.focus();
  };

  return (
    <section
      className="hm-product-tour"
      id="workspaces"
      aria-labelledby="workspace-title"
    >
      <div className="hm-product-tour__intro">
        <p className="hm-landing-index">02 / ROLE WORKSPACES</p>
        <p className="hm-landing-kicker">Purpose-built access</p>
        <h2 id="workspace-title">One system. Four focused views.</h2>
        <p>
          The interface changes with the job. Each role receives the records
          and actions it is permitted to use—nothing more.
        </p>

        <div className="hm-role-tabs" role="tablist" aria-label="Choose a role">
          {Object.entries(roleWorkspaces).map(([key, role]) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeRole === key}
              aria-controls="role-workspace-preview"
              id={`role-tab-${key}`}
              tabIndex={activeRole === key ? 0 : -1}
              key={key}
              onClick={() => setActiveRole(key)}
              onKeyDown={(event) => handleRoleKeyDown(event, key)}
            >
              <span>{role.label}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <div
        className="hm-workspace-stage"
        id="role-workspace-preview"
        role="tabpanel"
        aria-labelledby={`role-tab-${activeRole}`}
      >
        <div className="hm-workspace-stage__copy">
          <p>{workspace.eyebrow}</p>
          <h3>{workspace.title}</h3>
          <span>{workspace.description}</span>
        </div>

        <div className="hm-workspace-window" aria-label={`${workspace.label} product preview`}>
          <aside aria-label="Preview navigation">
            <strong>HostelMate</strong>
            <span>{workspace.label}</span>
            <nav>
              {workspace.navigation.map((item) => (
                <span
                  className={item === workspace.activeNavigation ? "is-active" : undefined}
                  key={item}
                >
                  {item}
                </span>
              ))}
            </nav>
          </aside>
          <div className="hm-workspace-window__content">
            <header>
              <div>
                <span>{workspace.panelMeta}</span>
                <strong>{workspace.panelTitle}</strong>
              </div>
              <CircleUserRound aria-hidden="true" />
            </header>
            <div className="hm-workspace-window__rows">
              {workspace.rows.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const LandingPage = () => (
  <div className="hm-landing">
    <section
      className="hm-editorial-hero"
      id="platform"
      aria-labelledby="landing-title"
    >
      <div className="hm-editorial-hero__copy">
        <p className="hm-landing-index">HOSTELMATE / CAMPUS RESIDENCE PLATFORM</p>
        <p className="hm-landing-kicker">One accountable workspace</p>
        <h1 id="landing-title" aria-label="One operating system for hostel life.">
          <span>One operating system</span>
          <span>for hostel life.</span>
        </h1>
        <p className="hm-editorial-hero__intro">
          Manage residents, rooms, maintenance, leave approvals, gate
          movements, mess operations, and campus communication without losing
          the history behind each decision.
        </p>
        <div className="hm-editorial-hero__actions">
          <ButtonLink to="/login" variant="primary" size="touch">
            Open your workspace
            <ArrowRight aria-hidden="true" />
          </ButtonLink>
          <ButtonLink to="/register" variant="secondary" size="touch">
            Activate student account
          </ButtonLink>
        </div>
        <p className="hm-editorial-hero__note">
          For a single college operating multiple hostel buildings.
        </p>
      </div>

      <div className="hm-campus-ledger" aria-label="Sample HostelMate records">
        <header className="hm-campus-ledger__header">
          <div>
            <span>PRODUCT PREVIEW · SAMPLE RECORDS</span>
            <h2>Campus operations desk</h2>
          </div>
          <div className="hm-campus-ledger__hostels" aria-label="Hostel scope">
            <span className="is-current">H1</span>
            <span>H2</span>
          </div>
        </header>

        <div className="hm-campus-ledger__columns" aria-hidden="true">
          <span>Record</span>
          <span>Responsible team</span>
          <span>Status</span>
        </div>

        <div className="hm-campus-ledger__records">
          {operationalRecords.map((item) => (
            <article key={item.id}>
              <div className="hm-campus-ledger__record">
                <span>{item.id}</span>
                <strong>{item.record}</strong>
                <small>{item.location}</small>
              </div>
              <span className="hm-campus-ledger__owner">{item.owner}</span>
              <span
                className={`hm-campus-ledger__status hm-campus-ledger__status--${item.tone}`}
              >
                {item.status}
              </span>
            </article>
          ))}
        </div>

        <footer>
          <ShieldCheck aria-hidden="true" />
          Hostel and role permissions stay attached to every action.
        </footer>
      </div>
    </section>

    <div className="hm-capability-rail" aria-label="Core platform capabilities">
      <span>Resident records</span>
      <span>Room allocation</span>
      <span>Complaint SLAs</span>
      <span>Secure gate passes</span>
      <span>Mess operations</span>
    </div>

    <section
      className="hm-workflow-story"
      id="workflows"
      aria-labelledby="workflow-title"
    >
      <div className="hm-workflow-story__heading">
        <p className="hm-landing-index">01 / FLAGSHIP WORKFLOWS</p>
        <p className="hm-landing-kicker">From request to outcome</p>
        <h2 id="workflow-title">Important work should never disappear in a chat thread.</h2>
        <p>
          HostelMate turns the two busiest hostel processes into visible,
          permission-controlled timelines.
        </p>
      </div>

      <div className="hm-complaint-track">
        <div className="hm-workflow-label">
          <Wrench aria-hidden="true" />
          <div>
            <span>Workflow A</span>
            <strong>Maintenance complaint</strong>
          </div>
        </div>
        <ol>
          {complaintSteps.map(([number, title, detail]) => (
            <li key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{detail}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="hm-leave-track">
        <div className="hm-workflow-label">
          <DoorOpen aria-hidden="true" />
          <div>
            <span>Workflow B</span>
            <strong>Leave and gate movement</strong>
          </div>
        </div>
        <ol>
          {leaveSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </div>
    </section>

    <RoleWorkspace />

    <section className="hm-campus-model" id="campus-model" aria-labelledby="campus-title">
      <div className="hm-campus-model__copy">
        <p className="hm-landing-index">03 / CAMPUS MODEL</p>
        <p className="hm-landing-kicker">Simple by design</p>
        <h2 id="campus-title">One college. Multiple hostels.</h2>
        <p>
          Administrators work across the college. Wardens and operational staff
          are assigned only to the hostel buildings they manage.
        </p>
        <ul>
          <li><Check aria-hidden="true" />Explicit hostel memberships</li>
          <li><Check aria-hidden="true" />Separate rooms and residents</li>
          <li><Check aria-hidden="true" />One mess operation per hostel</li>
        </ul>
      </div>

      <div className="hm-campus-map" aria-label="Example multi-hostel structure">
        <div className="hm-campus-map__college">
          <span>COLLEGE ADMINISTRATION</span>
          <strong>Institution workspace</strong>
        </div>
        <div className="hm-campus-map__line" aria-hidden="true" />
        <div className="hm-campus-map__hostels">
          <article>
            <span>H1</span>
            <div><strong>North Residence</strong><small>Rooms · Residents · Mess</small></div>
          </article>
          <article>
            <span>H2</span>
            <div><strong>South Residence</strong><small>Rooms · Residents · Mess</small></div>
          </article>
        </div>
      </div>

      <div className="hm-campus-model__security">
        <ShieldCheck aria-hidden="true" />
        <div><strong>Server-enforced access</strong><span>Roles and hostel scope come from stored assignments, not selections made in the browser.</span></div>
        <div><strong>Traceable decisions</strong><span>Workflow events preserve who acted, what changed, and when it happened.</span></div>
      </div>
    </section>

    <section className="hm-access-panel" id="access" aria-labelledby="access-title">
      <div className="hm-access-panel__mark" aria-hidden="true">HM</div>
      <div className="hm-access-panel__copy">
        <p>HOSTELMATE ACCESS</p>
        <h2 id="access-title">Your hostel workspace is ready when you are.</h2>
        <span>
          Existing users sign in directly. Approved students activate their
          account using the institutional details held by the hostel office.
        </span>
      </div>
      <div className="hm-access-panel__actions">
        <ButtonLink to="/login" variant="primary" size="touch">
          Sign in
          <ArrowRight aria-hidden="true" />
        </ButtonLink>
        <ButtonLink to="/register" variant="secondary" size="touch">
          Student activation
        </ButtonLink>
      </div>
    </section>

    <footer className="hm-landing-footer">
      <div>
        <strong>HostelMate</strong>
        <span>Campus residence operations</span>
      </div>
      <p>Residents · Rooms · Complaints · Leave · Gate · Mess</p>
      <span>One college deployment</span>
    </footer>
  </div>
);

export default LandingPage;
