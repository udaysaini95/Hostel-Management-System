import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  ErrorState,
  Input,
  PageHeader,
  Panel,
  Select,
  Textarea,
} from "../components/ui/index.js";
import {
  addComplaintAttachment,
  createComplaint,
  getComplaintCategories,
} from "../complaints/complaintApi.js";
import {
  getComplaintFieldErrors,
  validateComplaintImage,
} from "../complaints/complaintView.js";
import { useToast } from "../feedback/toastContext.js";

const EMPTY_FORM = Object.freeze({
  categoryCode: "",
  location: "",
  description: "",
  requestedPriority: "",
});

const RaiseComplaint = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const categoryRef = useRef(null);
  const locationRef = useRef(null);
  const descriptionRef = useRef(null);

  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      setCategoriesError("");
      const records = await getComplaintCategories();
      if (records.length === 0) {
        throw new Error("No active complaint categories are available");
      }
      setCategories(records);
      setForm((current) => ({
        ...current,
        categoryCode: current.categoryCode || records[0]?.code || "",
      }));
    } catch (error) {
      setCategoriesError(
        getApiErrorMessage(error, "Complaint categories could not be loaded.")
      );
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  };

  const chooseImage = (event) => {
    const nextFile = event.target.files?.[0] ?? null;
    const error = validateComplaintImage(nextFile);

    if (error) {
      setFieldErrors((current) => ({ ...current, file: error }));
      event.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : "");
    setFieldErrors((current) => ({ ...current, file: "" }));
  };

  const removeImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setFieldErrors((current) => ({ ...current, file: "" }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.categoryCode) errors.categoryCode = "Choose a category.";
    if (!form.location.trim()) errors.location = "Enter the affected location.";
    if (form.description.trim().length < 10) {
      errors.description = "Describe the issue using at least 10 characters.";
    }
    return errors;
  };

  const focusFirstError = (errors) => {
    const refs = {
      categoryCode: categoryRef,
      location: locationRef,
      description: descriptionRef,
    };
    const field = ["categoryCode", "location", "description"].find(
      (name) => errors[name]
    );
    if (field) window.requestAnimationFrame(() => refs[field].current?.focus());
  };

  const submitComplaint = async (event) => {
    event.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      const complaint = await createComplaint({
        categoryCode: form.categoryCode,
        location: form.location.trim(),
        description: form.description.trim(),
        ...(form.requestedPriority
          ? { requestedPriority: form.requestedPriority }
          : {}),
      });

      if (!complaint?.id) throw new Error("Complaint response was empty");

      if (file) {
        try {
          await addComplaintAttachment(complaint.id, file);
        } catch (attachmentError) {
          showToast({
            tone: "warning",
            title: "Complaint created without the image",
            message: getApiErrorMessage(
              attachmentError,
              "You can add the image from the complaint details page."
            ),
          });
          navigate(`/student/complaints/${complaint.id}`);
          return;
        }
      }

      showToast({
        tone: "success",
        title: "Complaint created",
        message: "Hostel staff can now review and assign the maintenance work.",
      });
      navigate(`/student/complaints/${complaint.id}`);
    } catch (error) {
      const serverErrors = getComplaintFieldErrors(error);
      setFieldErrors((current) => ({ ...current, ...serverErrors }));
      setFormError(
        getApiErrorMessage(error, "The complaint could not be created.")
      );
      focusFirstError(serverErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hm-page-stack hm-page-stack--narrow hm-complaints">
      <Link className="hm-complaints__back" to="/student/complaints">
        <ArrowLeft aria-hidden="true" /> Back to complaints
      </Link>

      <PageHeader
        eyebrow="Maintenance"
        title="Create complaint"
        description="Report one maintenance issue with enough detail for hostel staff to act."
      />

      {categoriesError ? (
        <ErrorState
          title="Complaint form unavailable"
          description={categoriesError}
          onRetry={loadCategories}
          retrying={categoriesLoading}
        />
      ) : (
        <Panel as="form" className="hm-complaint-form" onSubmit={submitComplaint}>
          <div className="hm-complaint-form__section">
            <h2>Issue details</h2>
            <p>Required fields are marked. Report a separate complaint for each issue.</p>
          </div>

          <Select
            ref={categoryRef}
            label="Category"
            required
            disabled={categoriesLoading}
            value={form.categoryCode}
            error={fieldErrors.categoryCode}
            onChange={(event) => updateField("categoryCode", event.target.value)}
          >
            {categoriesLoading ? (
              <option value="">Loading categories</option>
            ) : (
              categories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.name}
                </option>
              ))
            )}
          </Select>

          <Input
            ref={locationRef}
            label="Room or location"
            required
            maxLength={255}
            placeholder="For example, A-204 bathroom"
            value={form.location}
            error={fieldErrors.location}
            onChange={(event) => updateField("location", event.target.value)}
          />

          <Textarea
            ref={descriptionRef}
            label="Issue description"
            required
            rows={5}
            maxLength={2000}
            hint="Include what is wrong, when it started, and any safety concern."
            placeholder="The tap has been leaking continuously since this morning."
            value={form.description}
            error={fieldErrors.description}
            onChange={(event) => updateField("description", event.target.value)}
          />

          <Select
            label="Requested priority"
            hint="This is a request. The server applies the category policy and owns the final priority and SLA."
            value={form.requestedPriority}
            onChange={(event) => updateField("requestedPriority", event.target.value)}
          >
            <option value="">Use category policy</option>
            <option value="critical">Critical — immediate safety risk</option>
            <option value="high">High — significantly affects daily living</option>
            <option value="medium">Medium — standard maintenance</option>
            <option value="low">Low — minor inconvenience</option>
          </Select>

          <div className="hm-complaint-upload">
            <div>
              <label htmlFor="complaint-image">Photo evidence</label>
              <span>Optional</span>
            </div>
            <p>JPEG, PNG, or WebP. Maximum 5 MB.</p>
            {previewUrl && (
              <div className="hm-complaint-upload__preview">
                <img src={previewUrl} alt="Selected complaint evidence" />
                <div>
                  <strong>{file.name}</strong>
                  <Button
                    variant="danger-secondary"
                    leadingIcon={<X aria-hidden="true" />}
                    onClick={removeImage}
                  >
                    Remove image
                  </Button>
                </div>
              </div>
            )}
            <input
              id="complaint-image"
              className="hm-complaint-upload__input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={previewUrl ? "Replace photo evidence" : "Choose photo evidence"}
              onChange={chooseImage}
            />
            {fieldErrors.file && (
              <p className="hm-complaints__field-error" role="alert">
                {fieldErrors.file}
              </p>
            )}
          </div>

          {formError && (
            <p className="hm-complaints__form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="hm-complaint-form__footer">
            <Button type="submit" variant="primary" size="form" loading={saving} loadingLabel="Creating complaint" disabled={categoriesLoading}>
              Create complaint
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
};

export default RaiseComplaint;
