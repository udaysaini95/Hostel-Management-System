import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
  Textarea,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  getManageableMessHostels,
  getMessMenu,
  listMessMenus,
  saveMessMenu,
} from "./messApi.js";
import { MessWeekPicker } from "./MessWeekPicker.jsx";
import {
  addCalendarDays,
  formatMenuDate,
  getCalendarRange,
  getLocalCalendarDate,
  MEAL_SECTIONS,
  menuToEditor,
  validateMenuEditor,
} from "./messView.js";

const emptyEditor = () => menuToEditor(null);

export const MessMenuEditor = () => {
  const today = useMemo(() => getLocalCalendarDate(), []);
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState("");
  const [hostelsLoading, setHostelsLoading] = useState(true);
  const [hostelsError, setHostelsError] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [publishedDates, setPublishedDates] = useState(new Set());
  const [menu, setMenu] = useState(null);
  const [fields, setFields] = useState(emptyEditor);
  const [fieldErrors, setFieldErrors] = useState({});
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const latestMenuRequest = useRef(0);
  const { showToast } = useToast();

  const loadHostels = useCallback(async () => {
    try {
      setHostelsLoading(true);
      setHostelsError("");
      const records = await getManageableMessHostels();
      setHostels(records);
      setHostelId((current) => current || String(records[0]?.id ?? ""));
    } catch (error) {
      setHostelsError(
        getApiErrorMessage(error, "Your hostel assignments could not be loaded.")
      );
    } finally {
      setHostelsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  const loadSelectedMenu = useCallback(async () => {
    if (!hostelId) return;
    const requestId = latestMenuRequest.current + 1;
    latestMenuRequest.current = requestId;
    try {
      setMenuLoading(true);
      setMenuError("");
      setFieldErrors({});
      const record = await getMessMenu({ date: selectedDate, hostelId });
      if (latestMenuRequest.current === requestId) {
        setMenu(record);
        setFields(menuToEditor(record));
      }
    } catch (error) {
      if (latestMenuRequest.current !== requestId) return;
      if (error.response?.status === 404) {
        setMenu(null);
        setFields(emptyEditor());
      } else {
        setMenu(null);
        setFields(emptyEditor());
        setMenuError(
          getApiErrorMessage(error, "This menu could not be loaded for editing.")
        );
      }
    } finally {
      if (latestMenuRequest.current === requestId) setMenuLoading(false);
    }
  }, [hostelId, selectedDate]);

  useEffect(() => {
    loadSelectedMenu();
  }, [loadSelectedMenu, refreshVersion]);

  useEffect(() => {
    if (!hostelId) return;
    let active = true;
    listMessMenus({ ...getCalendarRange(startDate), hostelId })
      .then((result) => {
        if (active) setPublishedDates(new Set((result?.menus ?? []).map((item) => item.date)));
      })
      .catch(() => {
        if (active) setPublishedDates(new Set());
      });
    return () => {
      active = false;
    };
  }, [hostelId, refreshVersion, startDate]);

  const selectDate = (date) => {
    setSelectedDate(date);
    setFieldErrors({});
  };

  const changeDateInput = (event) => {
    const date = event.target.value;
    if (!date) return;
    setSelectedDate(date);
    setStartDate(date);
  };

  const navigateWeek = (amount) => {
    const nextDate = addCalendarDays(startDate, amount);
    setStartDate(nextDate);
    setSelectedDate(nextDate);
  };

  const updateField = (key, value) => {
    setFields((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submitMenu = async (event) => {
    event.preventDefault();
    const validation = validateMenuEditor(fields);
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    try {
      setSaving(true);
      const savedMenu = await saveMessMenu({
        date: selectedDate,
        hostelId: Number(hostelId),
        meals: validation.meals,
      });
      setMenu(savedMenu);
      setFields(menuToEditor(savedMenu));
      setRefreshVersion((version) => version + 1);
      showToast({
        tone: "success",
        title: savedMenu.version === 1 ? "Menu published" : "Menu updated",
        message: `${formatMenuDate(selectedDate)} is now version ${savedMenu.version}.`,
      });
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Menu was not saved",
        message: getApiErrorMessage(error, "Review the menu and try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  if (hostelsLoading) return <LoadingState label="Loading manageable hostels" rows={3} />;
  if (hostelsError) {
    return <ErrorState title="Hostel choices are unavailable" description={hostelsError} onRetry={loadHostels} />;
  }
  if (hostels.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No hostel assignment available"
        description="An active hostel assignment is required before menus can be published."
      />
    );
  }

  return (
    <section className="hm-mess-editor" aria-labelledby="menu-editor-title">
      <Panel className="hm-mess-editor__controls">
        <Select label="Hostel" value={hostelId} onChange={(event) => setHostelId(event.target.value)} required>
          {hostels.map((hostel) => (
            <option key={hostel.id} value={hostel.id}>{hostel.code} — {hostel.name}</option>
          ))}
        </Select>
        <Input label="Menu date" type="date" value={selectedDate} onChange={changeDateInput} required />
      </Panel>

      <MessWeekPicker
        startDate={startDate}
        selectedDate={selectedDate}
        publishedDates={publishedDates}
        onSelect={selectDate}
        onPrevious={() => navigateWeek(-7)}
        onNext={() => navigateWeek(7)}
      />

      {menuLoading ? (
        <LoadingState label="Loading menu editor" rows={4} />
      ) : menuError ? (
        <ErrorState title="Menu editor is unavailable" description={menuError} onRetry={loadSelectedMenu} />
      ) : (
        <Panel
          as="form"
          className="hm-mess-editor__form"
          onSubmit={submitMenu}
          noValidate
        >
          <div className="hm-mess-editor__heading">
            <div>
              <h2 id="menu-editor-title">{menu ? "Edit published menu" : "Publish a menu"}</h2>
              <p>{formatMenuDate(selectedDate)} · Enter one food item per line.</p>
            </div>
            {menu && <span>Current version {menu.version}</span>}
          </div>

          <div className="hm-mess-editor__fields">
            {MEAL_SECTIONS.map(({ key, label }) => (
              <Textarea
                key={key}
                label={label}
                hint={key === "snacks" ? "Optional · one item per line" : "One item per line"}
                error={fieldErrors[key]}
                required={key !== "snacks"}
                rows={5}
                maxLength={3100}
                value={fields[key]}
                onChange={(event) => updateField(key, event.target.value)}
              />
            ))}
          </div>

          <div className="hm-mess-editor__footer">
            <p>
              {menu
                ? `Last published by ${menu.publishedBy?.name || "mess administration"}. Saving creates version ${menu.version + 1}.`
                : "Students will see this menu immediately after publication."}
            </p>
            <Button type="submit" variant="primary" size="touch" loading={saving} loadingLabel="Saving menu" leadingIcon={<Check aria-hidden="true" />}>
              {menu ? "Update menu" : "Publish menu"}
            </Button>
          </div>
        </Panel>
      )}
    </section>
  );
};
