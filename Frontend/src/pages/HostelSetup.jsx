import { useCallback, useEffect, useState } from "react";
import { Building2, Boxes, Pencil, Plus } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  ConfirmationDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Textarea,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import { HostelInventoryManager } from "../hostels/HostelInventoryManager.jsx";
import {
  changeHostelStatus,
  createHostel,
  getHostels,
  updateHostel,
} from "../hostels/hostelApi.js";
import {
  getResidentTypeLabel,
  HOSTEL_RESIDENT_TYPES,
  validateHostelForm,
} from "../hostels/hostelView.js";

const EMPTY_FORM = Object.freeze({
  code: "",
  name: "",
  residentType: "boys",
  address: "",
});

const HostelSetup = () => {
  const { showToast } = useToast();
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [editingHostel, setEditingHostel] = useState(null);
  const [statusHostel, setStatusHostel] = useState(null);
  const [managedHostel, setManagedHostel] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadHostels = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getHostels();
      setHostels(result.hostels ?? []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not load hostels."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  const openCreateDialog = () => {
    setEditingHostel({ id: null });
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const openEditDialog = (hostel) => {
    setEditingHostel(hostel);
    setForm({
      code: hostel.code,
      name: hostel.name,
      residentType: hostel.residentType,
      address: hostel.address ?? "",
    });
    setFormErrors({});
  };

  const closeForm = () => {
    if (!saving) setEditingHostel(null);
  };

  const saveHostel = async (event) => {
    event.preventDefault();
    const errors = validateHostelForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const values = {
        name: form.name.trim(),
        residentType: form.residentType,
        address: form.address.trim(),
      };
      const result = editingHostel.id
        ? await updateHostel(editingHostel.id, values)
        : await createHostel({ ...values, code: form.code.trim().toUpperCase() });

      setHostels((current) =>
        [...current.filter((hostel) => hostel.id !== result.hostel.id), result.hostel]
          .sort((left, right) => left.code.localeCompare(right.code))
      );
      setManagedHostel((current) =>
        current?.id === result.hostel.id ? result.hostel : current
      );
      setEditingHostel(null);
      showToast({
        tone: "success",
        title: editingHostel.id ? "Hostel updated" : "Hostel created",
        message: `${result.hostel.code} — ${result.hostel.name}`,
      });
    } catch (requestError) {
      showToast({
        tone: "danger",
        title: "Hostel was not saved",
        message: getApiErrorMessage(requestError, "Try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmStatusChange = async () => {
    const nextStatus = !statusHostel.isActive;
    setSaving(true);
    try {
      const result = await changeHostelStatus(statusHostel.id, nextStatus);
      setHostels((current) =>
        current.map((hostel) =>
          hostel.id === result.hostel.id ? result.hostel : hostel
        )
      );
      setManagedHostel((current) =>
        current?.id === result.hostel.id ? result.hostel : current
      );
      setStatusHostel(null);
      showToast({
        tone: "success",
        title: nextStatus ? "Hostel activated" : "Hostel deactivated",
        message: result.hostel.name,
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
    <div className="hm-page-stack hm-page-stack--wide">
      <PageHeader
        eyebrow="Institution setup"
        title="Hostels"
        description="Create hostel buildings and control which resident group each building accommodates."
        action={
          <Button
            variant="primary"
            leadingIcon={<Plus aria-hidden="true" />}
            onClick={openCreateDialog}
          >
            Add hostel
          </Button>
        }
      />

      <Panel padding="none">
        {loading ? (
          <LoadingState label="Loading hostels" rows={4} />
        ) : error ? (
          <ErrorState description={error} onRetry={loadHostels} />
        ) : hostels.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No hostels configured"
            description="Add the first hostel before approving students or creating rooms."
            action={<Button onClick={openCreateDialog}>Add hostel</Button>}
          />
        ) : (
          <>
            <Table caption="Configured hostels" hideCaption className="hm-hostel-table">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Hostel</TableHeaderCell>
                  <TableHeaderCell>Residents</TableHeaderCell>
                  <TableHeaderCell>Address</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell><span className="hm-visually-hidden">Actions</span></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hostels.map((hostel) => (
                  <TableRow key={hostel.id}>
                    <TableCell><strong>{hostel.code}</strong><span>{hostel.name}</span></TableCell>
                    <TableCell>{getResidentTypeLabel(hostel.residentType)}</TableCell>
                    <TableCell>{hostel.address || "Not provided"}</TableCell>
                    <TableCell><StatusBadge status={hostel.isActive ? "active" : "inactive"}>{hostel.isActive ? "Active" : "Inactive"}</StatusBadge></TableCell>
                    <TableCell actions>
                      <Button variant="quiet" leadingIcon={<Boxes aria-hidden="true" />} onClick={() => setManagedHostel(hostel)}>Blocks & rooms</Button>
                      <Button variant="quiet" leadingIcon={<Pencil aria-hidden="true" />} onClick={() => openEditDialog(hostel)}>Edit</Button>
                      <Button variant="quiet" onClick={() => setStatusHostel(hostel)}>{hostel.isActive ? "Deactivate" : "Activate"}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="hm-hostel-cards">
              {hostels.map((hostel) => (
                <article key={hostel.id}>
                  <header><div><strong>{hostel.code}</strong><h2>{hostel.name}</h2></div><StatusBadge status={hostel.isActive ? "active" : "inactive"}>{hostel.isActive ? "Active" : "Inactive"}</StatusBadge></header>
                  <dl><div><dt>Residents</dt><dd>{getResidentTypeLabel(hostel.residentType)}</dd></div><div><dt>Address</dt><dd>{hostel.address || "Not provided"}</dd></div></dl>
                  <footer><Button onClick={() => setManagedHostel(hostel)}>Blocks & rooms</Button><Button onClick={() => openEditDialog(hostel)}>Edit</Button><Button onClick={() => setStatusHostel(hostel)}>{hostel.isActive ? "Deactivate" : "Activate"}</Button></footer>
                </article>
              ))}
            </div>
          </>
        )}
      </Panel>

      {managedHostel && (
        <HostelInventoryManager
          key={managedHostel.id}
          hostel={managedHostel}
          onClose={() => setManagedHostel(null)}
        />
      )}

      <Dialog
        open={Boolean(editingHostel)}
        title={editingHostel?.id ? "Edit hostel" : "Add hostel"}
        description="A hostel code is permanent after creation."
        onDismiss={closeForm}
        dismissDisabled={saving}
        footer={<><Button onClick={closeForm} disabled={saving}>Cancel</Button><Button variant="primary" type="submit" form="hostel-form" loading={saving} loadingLabel="Saving">Save hostel</Button></>}
      >
        <form id="hostel-form" className="hm-hostel-form" onSubmit={saveHostel}>
          <Input label="Hostel code" required disabled={Boolean(editingHostel?.id)} value={form.code} error={formErrors.code} onChange={(event) => setForm({ ...form, code: event.target.value })} hint="For example BH1 or GH1" />
          <Input label="Hostel name" required value={form.name} error={formErrors.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Select label="Resident type" required value={form.residentType} error={formErrors.residentType} onChange={(event) => setForm({ ...form, residentType: event.target.value })}>
            {HOSTEL_RESIDENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </Select>
          <Textarea label="Address" rows={3} value={form.address} error={formErrors.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </form>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(statusHostel)}
        title={`${statusHostel?.isActive ? "Deactivate" : "Activate"} hostel?`}
        description={statusHostel?.isActive ? "Deactivation is blocked while the hostel has assigned students or staff." : "The hostel will become available for onboarding and operations again."}
        confirmLabel={statusHostel?.isActive ? "Deactivate hostel" : "Activate hostel"}
        tone={statusHostel?.isActive ? "danger" : "default"}
        loading={saving}
        onConfirm={confirmStatusChange}
        onDismiss={() => !saving && setStatusHostel(null)}
      />
    </div>
  );
};

export default HostelSetup;
