# HostelMate Frontend Design Guidelines

| Field | Value |
| --- | --- |
| Document version | 1.0 |
| Status | Mandatory design baseline |
| Date | 2026-09-01 |
| Applies to | All public, student, warden, maintenance, guard, and admin frontend screens |
| Related product document | `docs/PRD.md` |

## 1. Purpose

This document is the mandatory visual and interaction specification for HostelMate. All new frontend work and all redesign work must follow it.

The interface must look like a deliberately designed operational product for a real hostel. It must not look like a collection of AI-generated dashboard sections, a generic SaaS template, a design-dribbble experiment, or a set of unrelated Tailwind snippets.

When a design decision is not covered here, choose the option that is:

1. Clearer for the user's current task.
2. More consistent with an existing HostelMate pattern.
3. More restrained visually.
4. Easier to use with a keyboard and on a small screen.

Do not invent a new visual pattern merely to make a page look different.

## 2. Product design character

HostelMate should feel:

- Trustworthy.
- Calm.
- Operational.
- Precise.
- Human.
- Fast to scan.
- Suitable for daily use.

HostelMate should not feel:

- Futuristic or cyberpunk.
- Luxurious or decorative.
- Playful like a consumer social application.
- Corporate in a vague, stock-template way.
- Dense like a legacy government portal.
- Visually generated one section at a time without a system.

The visual reference is a well-maintained campus operations console: clean institutional surfaces, clear labels, compact controls, visible status, and minimal decoration.

## 3. Strict anti-AI-generated design rules

The following patterns are prohibited unless a documented product need explicitly requires one.

### 3.1 Prohibited visual patterns

- No purple-to-blue gradient backgrounds.
- No gradient buttons.
- No glassmorphism panels or blurred translucent cards.
- No glowing borders, neon shadows, or floating light blobs.
- No random colored icon squares on every card.
- No giant hero headline taking most of the first viewport.
- No repeated three-column feature-card sections on application pages.
- No excessive card grids when a table, list, or single grouped section is clearer.
- No card-inside-card-inside-card layouts.
- No rounded pill shape for every button, input, tab, and container.
- No large decorative illustrations unrelated to the workflow.
- No stock hostel, student, or office photography as a page background.
- No emoji as functional icons or status indicators.
- No fake charts, fake ratings, fake activity, or invented dashboard statistics.
- No meaningless trend arrows or percentages without a defined comparison period.
- No animated counters added only for visual effect.
- No excessive entrance animations, staggered card reveals, or parallax.
- No alternating arbitrary colors between pages.
- No mixing filled, outline, 3D, and emoji icon styles.
- No vague marketing phrases such as “Seamless Excellence,” “Elevate Your Experience,” or “Revolutionizing Hostel Life.”
- No claims such as “production-grade,” “AI-powered,” or “real-time” unless the implementation and evidence support them.

### 3.2 Prohibited implementation habits

- Do not design each page independently with new colors, spacing, and component shapes.
- Do not copy large generated Tailwind class strings between pages.
- Do not use arbitrary hex colors in page components when a design token exists.
- Do not add a new shadow, radius, breakpoint, or font size without updating this design system.
- Do not use hardcoded sample operational data as a fallback for failed API requests.
- Do not hide an API error by rendering `0`, “No records,” or a successful-looking empty state.
- Do not build desktop-only tables without a deliberate narrow-screen representation.
- Do not make an entire card clickable while also placing unrelated buttons inside it.
- Do not use `alert`, `confirm`, or `prompt` as the finished interaction design.

### 3.3 Human-designed quality test

Before accepting a page, reviewers must be able to answer:

- What is the primary task on this page?
- What is the single most important action?
- Which information is live, and what is its source?
- What happens when there is no data?
- What happens when one request fails?
- What can this role not do?
- Which existing component patterns does the page reuse?

If these answers are unclear, the page is not ready for visual polish.

## 4. Visual foundation

### 4.1 Theme policy

Release 1 uses a light theme. Dark mode is not required.

Do not build different visual themes for student, warden, guard, and admin areas. Roles may have a small identifying label or accent, but the overall product must remain visually consistent.

### 4.2 Color tokens

Use semantic tokens rather than raw colors in components.

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | `#F6F7F9` | Application background |
| `surface` | `#FFFFFF` | Primary panels, menus, forms |
| `surface-subtle` | `#F0F2F5` | Secondary grouped content and hover rows |
| `surface-selected` | `#EEF2FF` | Selected navigation or row state |
| `text-primary` | `#172033` | Headings and primary text |
| `text-secondary` | `#526071` | Supporting text |
| `text-muted` | `#7A8699` | Metadata and disabled labels |
| `border` | `#DCE1E8` | Default borders and dividers |
| `border-strong` | `#BCC5D1` | Active field and emphasized divider |
| `brand` | `#3157D5` | Primary action and active navigation |
| `brand-hover` | `#2748B8` | Primary hover |
| `brand-soft` | `#E9EEFF` | Selected/soft brand background |
| `success` | `#13795B` | Completed, valid, approved |
| `success-soft` | `#EAF7F1` | Success background |
| `warning` | `#A85D00` | Pending, expiring, at risk |
| `warning-soft` | `#FFF4DF` | Warning background |
| `danger` | `#B42318` | Rejected, invalid, destructive, breached |
| `danger-soft` | `#FDECEA` | Danger background |
| `info` | `#175CD3` | Informational state |
| `info-soft` | `#EAF2FF` | Informational background |
| `focus` | `#84ADFF` | Focus ring |

Rules:

- Brand blue is the only default action color.
- Green means a confirmed successful or valid state; it is not decorative.
- Red means error, breach, invalid state, or destructive action; it is not decorative.
- Amber means pending, expiring, warning, or SLA risk.
- Use neutral colors for ordinary cards and navigation.
- Data visualizations may use an approved chart palette, but UI controls must continue using semantic tokens.
- Text and control contrast must meet WCAG AA expectations.

### 4.3 Typography

Use one sans-serif family across the product:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

Use tabular numerals for IDs, pass codes, counts, timestamps where alignment matters, and SLA durations.

| Style | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Display | `32px / 40px` | 700 | Public landing headline only |
| Page title | `24px / 32px` | 700 | Authenticated page title |
| Section title | `18px / 26px` | 650–700 | Major page section |
| Card/title | `15px / 22px` | 600 | Cards, dialogs, grouped content |
| Body | `14px / 21px` | 400 | Default application text |
| Body strong | `14px / 21px` | 600 | Labels and emphasized values |
| Small | `13px / 18px` | 400–600 | Table cells, metadata, helper text |
| Caption | `12px / 16px` | 500 | Timestamps and compact annotations |

Rules:

- Do not use authenticated page titles larger than 24px.
- Do not use uppercase for ordinary headings or buttons.
- Uppercase may be used sparingly for 11–12px section labels with letter spacing.
- Do not use font weight 800/900 across large areas.
- Avoid paragraphs wider than approximately 70 characters on informational pages.
- Page titles describe the content: “Leave requests,” not “Manage Your Leave Journey.”

### 4.4 Spacing

Use a 4px base spacing scale:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

Preferred rules:

- Page content gap: 24px.
- Major section gap: 32px.
- Panel padding: 20px desktop, 16px mobile.
- Form field gap: 16px.
- Label-to-control gap: 6px.
- Table cell horizontal padding: 12–16px.
- Do not use arbitrary spacing values unless required for alignment with an existing component.

### 4.5 Radius

| Token | Value | Use |
| --- | --- | --- |
| `radius-sm` | `4px` | Small status elements and tooltips |
| `radius-md` | `6px` | Inputs, buttons, table controls |
| `radius-lg` | `8px` | Panels, cards, menus |
| `radius-xl` | `12px` | Dialogs only |
| `radius-full` | `999px` | Avatar and compact status badge only |

Do not use 16–32px rounded containers across ordinary application screens.

### 4.6 Borders and shadows

- Default panels use a 1px `border` token.
- Prefer borders and background separation over shadows.
- Standard cards have no shadow or only `0 1px 2px rgba(16, 24, 40, 0.04)`.
- Dropdowns and popovers may use `0 8px 24px rgba(16, 24, 40, 0.12)`.
- Dialogs may use `0 20px 40px rgba(16, 24, 40, 0.16)`.
- Do not add colored shadows.
- Do not use shadows to indicate selected state; use border/background and clear labels.

## 5. Application shells

### 5.1 Public shell

Use for landing, sign-in, account activation, and password reset.

- Header height: 64px.
- Content maximum width: 1200px.
- Horizontal padding: 24px desktop, 16px mobile.
- White header with bottom border.
- Brand mark, product name, and at most two relevant actions.
- No full-screen stock-photo background.

### 5.2 Authenticated desktop shell

- Left navigation width: 232px.
- Top utility bar height: 56px.
- Main content maximum width: 1280px, except table-heavy pages which may use the available width.
- Main content padding: 32px on wide desktop, 24px on laptop/tablet.
- Canvas background with white surfaces.
- Sidebar remains neutral; active item uses `brand-soft` and brand text.
- Top bar contains page context, notification access, and account menu—not duplicated primary navigation.

### 5.3 Tablet shell

- At widths below 1024px, collapse the sidebar into a drawer.
- Preserve page title and primary action in the top content header.
- Data tables may horizontally scroll only when a list/card transformation would hide essential comparisons.

### 5.4 Mobile shell

- Mobile breakpoint begins at widths below 768px.
- Page horizontal padding: 16px.
- Primary action should remain visible without forcing horizontal scroll.
- Student screens may use a bottom navigation with no more than four primary destinations plus “More.”
- Staff screens use a compact top bar and navigation drawer.
- Do not display a desktop sidebar squeezed into a narrow viewport.
- Touch targets must be at least 44px in the primary mobile workflows.

### 5.5 Guard terminal shell

The guard terminal is a specialized operational surface:

- Use the full available content width.
- Keep search/scan controls near the top.
- Keep the verified identity and allowed next action together.
- Use large 48px action buttons for exit/return on touch devices.
- Do not surround the scanner with decorative cards or distracting metrics.
- A manual lookup must remain visible when camera access fails.

## 6. Navigation

### 6.1 Information architecture

Navigation must reflect a user's job, not the database table names.

Recommended student navigation:

- Overview.
- Complaints.
- Leave and gate pass.
- Mess.
- Notices.
- Profile.

Recommended warden navigation:

- Overview.
- Residents and rooms.
- Complaints.
- Leave requests.
- Gate activity.
- Mess.
- Notices.
- Reports.

Recommended maintenance navigation:

- My work.
- All assigned.
- Completed.

Recommended guard navigation:

- Gate terminal.
- Outside roster.
- Movement history.

Recommended admin navigation:

- Overview.
- Accounts and roles.
- Hostel setup.
- Audit log.
- System settings.

### 6.2 Navigation rules

- Do not show routes a role cannot use.
- Navigation labels must be stable across pages.
- Avoid separate navigation components with different styling for each role.
- Use Lucide icons consistently at 18–20px.
- Every icon must have a text label in primary navigation.
- Use breadcrumbs only when there are at least two meaningful hierarchy levels.
- Mobile navigation must expose all destinations through the primary bar or “More” drawer.

## 7. Page composition

Every authenticated page should follow this order when applicable:

1. Page header.
2. Critical alert or blocking state.
3. Primary controls/filters.
4. Main content.
5. Supporting context or history.

### 7.1 Page header

The page header contains:

- One clear title.
- Optional one-line description.
- One primary action at most.
- Secondary actions in an overflow menu or visually secondary group.

Do not wrap a page header in a decorative card unless the header itself contains actionable summary information.

### 7.2 Panels and cards

Use a panel/card only when it groups content that belongs together.

Good uses:

- A current gate-pass summary.
- A complaint detail summary.
- A form section.
- A dashboard metric that links to a real queue.

Bad uses:

- Wrapping every heading.
- Turning every navigation option into a promotional card.
- Placing individual table cells in cards on desktop.
- Adding a card solely to display one icon and one sentence.

### 7.3 Metric tiles

- Maximum of four in a top dashboard row.
- Every metric needs a precise label and defined calculation.
- Use a neutral surface; status color appears only in supporting text or a small indicator.
- Show comparison only if the period and source are explicit.
- A failed metric shows “Unavailable” with retry/context, never `0`.
- Avoid oversized numbers; 24–28px is sufficient.

## 8. Component specifications

### 8.1 Buttons

Variants:

- **Primary:** brand background, white text.
- **Secondary:** white background, default border, primary text.
- **Quiet:** transparent background, text-primary or brand text.
- **Danger:** danger background for confirmed destructive actions; otherwise use a danger-text secondary button.

Sizes:

- Default height: 36px.
- Form primary height: 40px.
- Guard touch action: 48px.
- Icon-only button: 36×36px desktop, at least 44×44px for primary mobile actions.

Rules:

- Button labels use verbs: “Approve leave,” “Assign complaint,” “Record exit.”
- Do not use vague “Submit” when a precise action exists.
- Only one visually primary button per local action group.
- Show a spinner and action label while pending; preserve button width.
- Disable repeated submission, but do not use disabled state instead of validation feedback.
- Icon-only buttons require an accessible name and tooltip when meaning is not universal.

### 8.2 Inputs and forms

- Input height: 40px.
- Visible label above every control.
- Placeholder is an example, not a replacement for a label.
- Helper and error text appears below the field.
- Required status is communicated in text or form instructions.
- Use appropriate input types and browser autocomplete.
- Group related fields under a short section heading.
- Long forms use sections, not one giant card.
- Validation appears inline and the first invalid field receives focus after submission.
- Date/time fields explain the active timezone when operationally important.
- Destructive changes or staff decisions use a proper dialog, not browser prompts.

### 8.3 Select, combobox, and search

- Use a native select for short stable option sets.
- Use a searchable combobox for students, rooms, staff, or long lists.
- Search input must have a clear button when populated.
- Debounce server search and communicate loading.
- Do not load thousands of records into a client-only select.

### 8.4 Status badges

- Use compact badges for status, never as primary action buttons.
- Badge text uses the exact domain term.
- Include an icon or text cue where color alone would be ambiguous.
- Keep colors consistent across the entire application.

Recommended mapping:

| Meaning | Treatment |
| --- | --- |
| Created / informational | Info soft background and info text |
| Assigned / scheduled | Brand soft background and brand text |
| Pending / expiring | Warning soft background and warning text |
| In progress | Info soft background and info text |
| Approved / valid / resolved / returned | Success soft background and success text |
| Rejected / invalid / breached / overdue | Danger soft background and danger text |
| Closed / inactive / expired | Neutral subtle background and secondary text |

### 8.5 Tables

- Use tables when users need to compare multiple records by the same fields.
- Header height: approximately 40px; row height: 48–56px.
- Left-align text; right-align numeric values when comparison benefits.
- Use tabular numerals for IDs and times.
- Keep the primary entity name in the first meaningful column.
- Row actions belong at the right and must be explicit or in a labeled overflow menu.
- Filters remain above the table, not embedded randomly in headers.
- Use server pagination for operational data.
- Show total results and current range.
- Empty, loading, error, and filtered-no-result states must be distinct.
- Avoid excessive vertical borders; use row dividers and alignment.
- Do not color entire rows unless there is a critical operational exception.

### 8.6 Lists

Use lists instead of tables for:

- Student-facing complaint history.
- Notices.
- Notifications.
- Mobile representations of operational records.
- Timeline events.

Each list row must maintain a consistent information order.

### 8.7 Dialogs and drawers

- Use dialogs for focused confirmation or short data entry.
- Use side drawers for contextual details that support a table without losing list position.
- Do not place full multi-section forms in small dialogs.
- Dialog title describes the consequence.
- Destructive confirmation states exactly what will happen.
- Focus must be trapped and restored correctly.

### 8.8 Toasts and inline messages

- Use toasts for non-blocking confirmation.
- Use inline messages for errors that affect the current content.
- Do not rely on a toast as the only record of an important workflow change.
- Error copy explains the next useful action when known.
- Avoid casual copy such as “Oops!” in operational failures.

### 8.9 Tabs

- Use tabs only for peer views of the same resource or module.
- Keep the tab count small and labels short.
- Tabs must not replace primary application navigation.
- Preserve tab state in the URL when users may share or revisit the view.

### 8.10 Timelines

- Use a vertical chronological timeline for complaint, leave, and audit history.
- Show event label, actor, timestamp, and note.
- Put the newest event first for operational review; provide consistent ordering everywhere.
- State changes must use exact terminology.
- Avoid decorative oversized timeline icons.

### 8.11 File attachments

- Show filename, type, size, upload time, and uploader when useful.
- Use a thumbnail only for actual images.
- Never show a broken public URL as a finished attachment state.
- Provide explicit “View” and “Download” actions as allowed by role.
- Loading and failed preview states must have a text alternative.

### 8.12 Charts

- Use a chart only when it communicates a trend, distribution, or comparison better than a number or table.
- Every chart needs a title, time range, unit, legend when needed, and no-data state.
- Do not use 3D charts, gauges, decorative radial charts, or rainbow palettes.
- Prefer line charts for time trends, horizontal bars for ranked categories, and stacked bars for composition.
- Limit a chart to approximately five primary series.
- Tooltips must format values and dates clearly.
- Charts must have a textual summary or accessible data alternative.

Approved chart palette:

```text
#3157D5  primary blue
#13795B  green
#A85D00  amber
#7A5AF8  violet, charts only
#2E90FA  light blue, charts only
#B42318  red, negative/breach only
```

## 9. Feedback states

Every data-driven component must explicitly support:

### Loading

- Use a skeleton that resembles the final structure for initial content.
- Use a small spinner for a local action.
- Do not block the entire page when independent sections can load separately.

### Empty

- State what is empty.
- Explain whether this is expected.
- Offer a relevant action only when the user has permission.
- Do not use celebratory illustrations for serious operational queues.

### Error

- Say which content could not load.
- Preserve unaffected content.
- Offer retry when it is safe.
- Do not display the empty-state copy for a failed request.

### Success

- Confirm the completed action using its domain language.
- Update the affected record or queue without requiring an unnecessary full-page reload.

### Unauthorized

- Clearly state that the user lacks permission.
- Provide a safe route back.
- Do not expose partial sensitive data before redirecting.

## 10. Page-specific design instructions

### 10.1 Landing page

Purpose: explain the product and provide sign-in/student registration.

- Use a compact two-column introduction on desktop and one column on mobile.
- Headline maximum: approximately 10 words and 32px.
- Use plain product language: complaints, leave approvals, and gate security.
- Primary action: “Sign in.” Secondary action: “Register as student.”
- Demonstrate one real workflow using a simple product screenshot, state flow, or compact interface preview.
- Do not use stock photography, glass cards, floating feature icons, or unsupported engineering claims.
- Limit the page to product summary, role/workflow explanation, and footer information.

### 10.2 Sign-in and registration

- Use a centered form with maximum width 400px.
- Use a plain canvas background and one bordered surface.
- Keep branding small and consistent.
- Do not display separate visual themes for each role.
- Public registration copy must clearly say it creates a student account.
- Do not expose an admin/warden/guard registration link.

### 10.3 Student overview

Information order:

1. Current active/urgent state: active gate pass, overdue action, or SLA warning.
2. Two primary actions: raise complaint and apply for leave.
3. Active complaints and latest leave status.
4. Today's menu.
5. Unread notices.

- Greeting remains small; operational content should be visible above the fold.
- Use at most three or four metric summaries.
- Recent records should be compact lists, not a grid of promotional cards.

### 10.4 Student complaints

- Default view is a readable list sorted by newest update.
- Show category, room/location, status, priority, SLA state, and updated time.
- Complaint detail contains summary, attachment, assignee, timeline, and available actions.
- “Confirm fixed” and “Reopen” appear only in the resolved state.
- Reopening uses a dialog with a required reason.
- SLA breach must be visible but not use flashing or pulsing animation.

### 10.5 Complaint creation

- Use a single-column form.
- Category may use a compact icon-supported choice group, but neutral styling remains dominant.
- Explain priority in plain language; the server owns the final priority/SLA.
- Show attachment limits before upload.
- Image preview includes remove/replace controls.
- Primary action is “Create complaint.”

### 10.6 Warden complaint queue

- Use a table on desktop and structured records on mobile.
- Default sort: SLA risk, priority, then oldest unresolved.
- Make breached and near-breach records easy to filter.
- Assignment and status changes should open a focused interaction rather than modify silently in a crowded row.
- A detail drawer may show timeline, student context, and attachments.
- Do not color the whole queue with status colors.

### 10.7 Maintenance work queue

- Focus only on assigned work and actionable status.
- Show priority, category, location, SLA remaining, and last update.
- Provide “Start work” and “Resolve” actions based on current state.
- Resolution form requires note and may accept evidence.
- Completed work is a separate view or filter, not mixed by default with active work.

### 10.8 Student leave and gate pass

- Separate “Apply for leave” from “My leave requests.”
- The current approved/exited pass receives the strongest placement.
- Show date/time range, reason, state, pass code, and QR where authorized.
- PDF download is a secondary action; the in-app pass remains usable.
- `EXITED` and `RETURNED` must never be styled as pending or rejected.
- Expired and overdue states use precise explanatory copy.

### 10.9 Warden leave queue

- Use a table or split list/detail layout.
- Default filter shows pending requests.
- Show student, room, dates, reason, conflicts, emergency flag, and submission time.
- Approval/rejection opens a review dialog with a decision note.
- Existing active/overlapping leave warnings appear before approval.
- Completed requests remain searchable without competing with the active queue.

### 10.10 Guard terminal

Information order:

1. Scan/manual lookup.
2. Verification result.
3. Single permitted action.
4. Outside roster.
5. Recent movement history.

- Valid verification uses a clear success header but does not make the entire screen green.
- Invalid/expired/reused passes use explicit danger treatment and no movement action.
- Student name, roll number, room, photo if authorized, validity window, and pass state must be easily scanned.
- The permitted button label must be exact: “Record exit” or “Record return.”
- Disable repeated actions while the request is pending.
- Show the completed timestamp and guard confirmation after success.
- Never use animated pulsing badges for security status.

### 10.11 Mess menu and feedback

- Use date navigation or a weekly calendar, not “latest record” semantics.
- Group meals consistently: breakfast, lunch, snacks if supported, dinner.
- Menu content should look like operational information, not restaurant marketing.
- Rating control includes an accessible numeric label.
- Student issue history appears below or in a peer tab.
- Admin view separates menu editing, feedback analytics, and issue queue.

### 10.12 Notices and notifications

- Notices use a list with title, audience/context, priority, publish date, and read state.
- Important notices use a restrained left border or badge, not a full red card.
- Notification center groups recent and earlier items.
- Each item links to an authorized resource when applicable.
- Unread state must remain perceivable without relying only on color.

### 10.13 Reports

- Begin with filters and reporting period.
- Show a compact summary followed by a small number of justified charts/tables.
- Define each metric in accessible help text.
- Export actions state the active format and respect filters.
- Do not mix unrelated complaint, gate, and mess charts on one page without grouping.

### 10.14 Account and audit administration

- Account lists emphasize name, role, status, last relevant activity, and actions.
- Role changes require explicit confirmation and appear in the audit log.
- Audit log is a dense searchable table with a detail drawer.
- Raw internal JSON should not be the default audit presentation; format important before/after changes clearly.

## 11. Iconography and imagery

- Use Lucide React as the single application icon set.
- Standard sizes: 16px inline, 18–20px navigation/controls, 24px empty state.
- Icons support labels; they do not replace important labels.
- Do not put every icon inside a colored rounded square.
- Avoid decorative building/student illustrations unless custom-created and genuinely useful.
- Use resident photos only when required for identity verification and authorized by the data policy.
- Do not use external hotlinked stock images or third-party icon URLs in production UI.
- Product screenshots must use fictional demo data.

## 12. Motion

- Standard transition duration: 120–180ms.
- Use motion for state continuity: drawer opening, menu appearance, row update, or loading completion.
- Do not animate ordinary page content into view.
- No bounce, glow, pulse, parallax, or continuous decorative animation.
- SLA breaches and invalid passes must not flash.
- Respect `prefers-reduced-motion`.

## 13. Content and microcopy

### 13.1 Voice

Use concise, direct, respectful language.

Good:

- “Leave approved.”
- “This pass expired on 12 Sep at 6:00 PM.”
- “Could not load gate activity. Try again.”
- “Add a resolution note before marking this complaint resolved.”

Avoid:

- “Awesome! Your request was successfully submitted!!!”
- “Oops, something went wrong.”
- “Unlock seamless hostel experiences.”
- “Supercharge your hostel journey.”

### 13.2 Naming consistency

Use these terms consistently unless the product model changes:

- Student.
- Warden.
- Maintenance staff.
- Guard.
- Administrator.
- Complaint.
- Leave request.
- Gate pass.
- Gate movement.
- Mess issue.
- Notice.

Do not alternate casually between “ticket,” “complaint,” “issue,” and “request” for the same entity.

### 13.3 Dates and identifiers

- Use readable local dates in UI, for example `12 Sep 2026, 6:30 PM`.
- Display timezone where cross-day or gate validity could be ambiguous.
- Use compact stable labels for IDs, for example `CMP-1042` and `LEV-0381`, if the product introduces public identifiers.
- Do not display raw database identifiers as the main title.
- Pass codes use a monospace/tabular style and must be easy to copy.

## 14. Responsive requirements

Every completed screen must be reviewed at minimum at:

- 360×800.
- 768×1024.
- 1024×768.
- 1440×900.

Rules:

- No horizontal page scroll at 360px.
- Main actions remain reachable without precision tapping.
- Filters may move into a drawer on mobile.
- Desktop tables use a deliberate mobile list/card representation when horizontal comparison is not essential.
- Dialogs become near-full-width with 16px margins on small screens.
- Sticky controls must not cover content or browser safe areas.
- QR scanner and manual input must remain usable in portrait orientation.

## 15. Accessibility requirements

- All interactive elements are keyboard reachable.
- Focus order follows visual and task order.
- Focus rings are always visible; do not remove outlines without an equivalent.
- Form fields have programmatic labels and associated error descriptions.
- Icon-only controls have accessible names.
- Dialogs trap focus and return focus on close.
- Status is communicated through text/icon as well as color.
- Charts have text summaries or accessible tables.
- Loading state changes use appropriate live regions where useful.
- Camera access has instructions and a manual alternative.
- Contrast targets WCAG 2.1 AA.
- Destructive and security-sensitive actions require clear confirmation and are not triggered by color/icon alone.

## 16. Tailwind and component implementation rules

- Define the tokens from this document in one theme location.
- Prefer semantic component variants over repeated long utility strings.
- Create shared primitives for Button, Input, Select, Badge, Panel, Dialog, Drawer, Table, EmptyState, ErrorState, Skeleton, Toast, and PageHeader.
- Use one class composition utility/pattern consistently.
- Do not create separate versions of the same primitive inside feature folders.
- Page components compose primitives and feature components; they should not redefine the global design system.
- Arbitrary values are allowed only when a token cannot represent a real layout requirement.
- Do not use inline styles except for values that are genuinely data-driven, such as chart geometry.
- Keep responsive and state variants near the component definition.
- Component behavior, accessibility, and API should be documented where reuse is expected.

## 17. Design review workflow

For each major page or workflow:

1. Confirm the PRD requirement IDs served by the page.
2. Write the primary user task and primary action.
3. Sketch the information hierarchy before styling.
4. Reuse existing shell and primitives.
5. Implement loading, empty, error, success, and unauthorized states.
6. Review role permissions and hidden/disabled actions.
7. Review all four required viewport sizes.
8. Complete keyboard and contrast checks.
9. Verify every metric and label against real API semantics.
10. Capture a screenshot for visual comparison during review.

A page is not design-complete because its happy-path screenshot looks polished.

## 18. Visual acceptance checklist

Every frontend pull request must satisfy the applicable items:

### System consistency

- [ ] Uses the approved application shell.
- [ ] Uses approved color, type, spacing, radius, and shadow tokens.
- [ ] Reuses shared components.
- [ ] Introduces no unexplained visual pattern.
- [ ] Uses Lucide icons only.
- [ ] Contains no stock background or decorative gradient.

### Product clarity

- [ ] Page purpose is understandable from the title and first content region.
- [ ] One primary action is visually clear.
- [ ] Domain terms match the PRD.
- [ ] Live values are not replaced by fake defaults.
- [ ] Status color and wording are consistent with other pages.
- [ ] Metrics state their real meaning.

### States and behavior

- [ ] Loading state exists.
- [ ] Genuine empty state exists.
- [ ] Error state is distinct from empty state.
- [ ] Unauthorized state is safe.
- [ ] Pending actions prevent duplicate submission.
- [ ] Destructive actions use a proper confirmation flow.

### Responsive and accessible

- [ ] Reviewed at 360, 768, 1024, and 1440 widths.
- [ ] No unintended horizontal page scroll.
- [ ] Touch targets are adequate.
- [ ] Keyboard navigation and focus are correct.
- [ ] Labels and errors are programmatically associated.
- [ ] Contrast and non-color status cues are acceptable.
- [ ] Reduced-motion behavior is respected.

### Anti-template review

- [ ] No glassmorphism, glow, gradient button, or decorative blob.
- [ ] No unnecessary card grid.
- [ ] No vague marketing copy.
- [ ] No random colored icon containers.
- [ ] No unsupported chart or trend.
- [ ] Page looks like part of HostelMate rather than a newly generated template.

## 19. Definition of frontend design done

Frontend design for a feature is done only when:

- It satisfies the mapped PRD acceptance criteria.
- It follows this document without undocumented exceptions.
- It uses the shared token and component system.
- All data and permission states are represented honestly.
- Responsive and keyboard behavior have been verified.
- The design has been reviewed using realistic fictional data, long content, missing content, and failure cases.
- Relevant component and end-to-end tests pass.
- No placeholder visual, fake metric, browser alert, hardcoded localhost URL, or dead action remains.

## 20. Exception process

If a product need genuinely conflicts with this document:

1. State the user problem.
2. Identify the conflicting rule.
3. Explain why existing components cannot solve it.
4. Provide the proposed reusable pattern and all states.
5. Review accessibility and responsive effects.
6. Update this document if the new pattern is accepted.

An exception must be based on a user/workflow requirement, not a desire to make the screen more visually impressive.
