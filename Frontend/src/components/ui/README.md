# HostelMate UI primitives

This folder is the shared visual foundation for the frontend. Feature pages should
import from `components/ui` and compose these primitives instead of copying long
utility-class strings or introducing new colors and radii.

The tokens live in `src/styles/theme.css`. Component styling lives in
`src/styles/components.css`. Keep raw color values out of feature components.

## Controls

`Button` supports `primary`, `secondary`, `quiet`, `danger`, and
`danger-secondary` variants. Its sizes are `default`, `form`, `touch`, and
`icon`.

Use `ButtonLink` when navigation should have the same visual treatment as a
button. It accepts the same `variant`, `size`, and `fullWidth` props while
retaining link behavior.

```jsx
<Button variant="primary" type="submit" loading={saving} loadingLabel="Saving">
  Save room assignment
</Button>

<Button variant="quiet" size="icon" aria-label="Close details">
  <X aria-hidden="true" />
</Button>
```

Icon-only buttons must have an `aria-label`. A loading button stays disabled and
keeps a visible action label while its spinner is shown.

`Input`, `Select`, and `Textarea` own the visible label and wire helper or error
text to the control. Use `className` for the field wrapper and
`controlClassName` for the native control.

```jsx
<Input
  id="student-email"
  label="Student email"
  type="email"
  autoComplete="email"
  required
  value={email}
  error={emailError}
  onChange={handleEmailChange}
/>

<Select label="Hostel" value={hostelId} onChange={handleHostelChange} required>
  <option value="">Select a hostel</option>
  {hostels.map((hostel) => (
    <option key={hostel.id} value={hostel.id}>{hostel.name}</option>
  ))}
</Select>
```

## Status and surfaces

Use `StatusBadge` when the text is a domain status. It maps the shared terms such
as `Pending`, `In progress`, `Approved`, `Rejected`, and `Closed` to one
consistent semantic tone. Use `Badge` with an explicit tone only when the value
is not a workflow status.

`Panel` groups related information. Its variants are `default`, `subtle`, and
`selected`; padding can be `default`, `compact`, or `none`. `PageHeader` provides
the page title, short description, and at most one primary action group.

## Operational data

`Table` supplies the bordered responsive wrapper and accepts a required-for-use
caption. Set `hideCaption` when the visible page heading already names the data.
Compose it with `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, and
`TableCell`. Mark comparable numbers with `numeric` and the final action cell
with `actions`.

```jsx
<Table caption="Pending leave requests" hideCaption>
  <TableHead>
    <TableRow>
      <TableHeaderCell>Student</TableHeaderCell>
      <TableHeaderCell>Hostel</TableHeaderCell>
      <TableHeaderCell>Departure</TableHeaderCell>
    </TableRow>
  </TableHead>
  <TableBody>{rows}</TableBody>
</Table>
```

## Overlays and feedback

`Dialog` is for focused entry. `ConfirmationDialog` provides consistent cancel,
confirm, danger, and pending behavior for consequential actions. `Drawer` is for
contextual details beside a list. These overlays move focus inside when opened,
keep Tab and Shift+Tab inside, close on Escape when an action is not pending,
prevent background scrolling, and return focus to the trigger.

`LoadingState`, `EmptyState`, `ErrorState`, `Skeleton`, and `Toast` provide the
visual primitives for honest feedback. Application pages publish non-blocking
notifications through `ToastProvider` and `useToast`. A danger toast uses an
assertive live region; other toast tones use a polite live region. Do not call
browser `alert`, `confirm`, or `prompt` APIs.

## Review rules

- Use one primary button in a local action group.
- Use exact domain wording in status badges.
- Keep a visible label on every form control.
- Give icon-only controls an accessible name.
- Do not remove the shared focus ring.
- Add a token before adding a reusable color, radius, shadow, or text size.
- Verify new primitives with keyboard navigation and reduced-motion settings.
