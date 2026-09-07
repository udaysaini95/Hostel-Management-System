# Validated Student CSV Imports

## Purpose

CSV import is a faster administrator workflow for approving many institutional
student identities. It creates the same `approved_students` records as the
single-student approval form. It does not create user accounts, set passwords,
send activation emails, or allocate rooms.

Students still prove ownership of their approved email through the normal
single-use activation flow after the import.

## Template

The frontend provides `student-approval-import-template.csv` from the student
onboarding page. It contains these four required headers:

```csv
name,email,roll_no,hostel_code
```

The columns may be reordered, but all four must appear exactly once and no
additional columns are accepted. Values follow the same normalization rules as
the single approval form:

- email addresses are trimmed and lowercased;
- roll numbers are trimmed, uppercased, and repeated spaces are collapsed;
- hostel codes are trimmed and uppercased;
- quoted commas, escaped quotes, UTF-8 BOM markers, CRLF, and quoted line breaks
  are supported.

One file may contain at most 500 student rows and must be no larger than 1 MB.
Only active, already-configured hostel codes are valid.

## API

`POST /api/admin/students/approvals/import?dryRun=true`

`POST /api/admin/students/approvals/import?dryRun=false`

Both requests use `multipart/form-data` with one `file` field and require the
administrator-only `student:import` permission.

The dry run parses the complete file and checks:

- required value formats;
- column count on every row;
- duplicate email addresses or roll numbers inside the file;
- existing approved-student conflicts;
- existing account conflicts; and
- active hostel codes.

It never writes approval or audit records. A successful review returns `200`:

```json
{
  "message": "CSV review completed",
  "report": {
    "mode": "dry-run",
    "canImport": true,
    "summary": {
      "totalRows": 2,
      "validRows": 2,
      "invalidRows": 0,
      "importedRows": 0
    }
  }
}
```

The response also includes each validated row in `rows`; it is omitted above
only to keep the example short. Invalid rows include stable field/error codes
and readable messages. Structural file errors such as an incorrect header
return `422` with a stable API error code.

After a successful dry run, the frontend sends the file again with
`dryRun=false`. The server repeats every validation against current database
state. If any row is now invalid, it returns `422 CSV_IMPORT_INVALID` and writes
nothing. Otherwise, all approvals and one hostel-scoped audit event are written
inside one transaction and the endpoint returns `201`.

## Interface flow

The administrator opens **Student onboarding** and chooses **Import CSV**.
The dialog explains the required columns, provides the template, and requires a
review before the import button appears. A valid review shows a compact preview;
an invalid review shows row numbers and field-specific corrections. The list is
refreshed after a completed import.

## Integrity and security boundaries

- Warden, maintenance, guard, and student roles do not receive the import
  permission.
- Files use memory storage and are never written to the public uploads folder.
- File type, file size, row count, UTF-8 decoding, and CSV structure are bounded.
- The confirmed operation revalidates instead of trusting an earlier preview.
- One invalid row prevents the whole batch from being written.
- Database uniqueness constraints remain the final concurrency boundary.
- The audit event records the actor, total row count, per-hostel counts, and
  affected hostel scopes without storing the uploaded CSV.
