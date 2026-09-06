import { useCallback, useEffect, useRef, useState } from "react";
import { BedDouble, Building2, Save, UserRound } from "lucide-react";
import api from "../api/axios.js";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Panel,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  formatResidentDate,
  getAccountStatusLabel,
  getAccountStatusTone,
  getStudentContactFieldErrors,
  getStudentContactPayload,
  validateStudentContact,
} from "../residents/residentView.js";

const EMPTY_CONTACT = Object.freeze({
  phone: "",
  guardianName: "",
  guardianPhone: "",
});

const getContactForm = (profile) => ({
  phone: profile?.phone ?? "",
  guardianName: profile?.guardian?.name ?? "",
  guardianPhone: profile?.guardian?.phone ?? "",
});

const StudentProfile = () => {
  const [profile, setProfile] = useState(null);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const phoneRef = useRef(null);
  const guardianNameRef = useRef(null);
  const guardianPhoneRef = useRef(null);
  const { showToast } = useToast();

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const response = await api.get("/api/student/profile");
      const nextProfile = response.data?.profile;

      if (!nextProfile) {
        throw new Error("Profile response was empty");
      }

      setProfile(nextProfile);
      setContact(getContactForm(nextProfile));
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, "Your student profile could not be loaded.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const focusFirstError = (errors) => {
    const refs = {
      phone: phoneRef,
      guardianName: guardianNameRef,
      guardianPhone: guardianPhoneRef,
    };
    const field = ["phone", "guardianName", "guardianPhone"].find(
      (name) => errors[name]
    );

    if (field) {
      window.requestAnimationFrame(() => refs[field].current?.focus());
    }
  };

  const updateContact = (field, value) => {
    setContact((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const errors = validateStudentContact(contact);

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      focusFirstError(errors);
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      const response = await api.patch(
        "/api/student/profile",
        getStudentContactPayload(contact)
      );
      const nextProfile = response.data?.profile;

      if (!nextProfile) {
        throw new Error("Profile response was empty");
      }

      setProfile(nextProfile);
      setContact(getContactForm(nextProfile));
      setFormErrors({});
      showToast({
        tone: "success",
        title: "Profile updated",
        message: "Your contact and guardian details were saved.",
      });
    } catch (error) {
      const serverErrors = getStudentContactFieldErrors(error);
      setFormErrors(serverErrors);
      setFormError(
        getApiErrorMessage(error, "Your profile changes could not be saved.")
      );
      focusFirstError(serverErrors);
    } finally {
      setSaving(false);
    }
  };

  const originalContact = getContactForm(profile);
  const hasChanges =
    profile &&
    Object.keys(originalContact).some(
      (field) => originalContact[field] !== contact[field]
    );

  return (
    <div className="hm-page-stack hm-page-stack--medium hm-profile">
      <PageHeader
        eyebrow="Resident account"
        title="My profile"
        description="Review your institutional and room details, and keep your contact information current."
      />

      {loading ? (
        <LoadingState label="Loading student profile" rows={4} />
      ) : loadError ? (
        <ErrorState
          title="Student profile unavailable"
          description={loadError}
          onRetry={loadProfile}
        />
      ) : (
        <>
          <Panel className="hm-profile__summary">
            <div className="hm-profile__section-heading">
              <div>
                <h2>{profile.name}</h2>
                <p>{profile.email}</p>
              </div>
              <Badge tone={getAccountStatusTone(profile.accountStatus)}>
                {getAccountStatusLabel(profile.accountStatus)}
              </Badge>
            </div>

            <dl className="hm-profile__identity-grid">
              <div>
                <dt>Roll number</dt>
                <dd className="hm-residents__mono">{profile.rollNo}</dd>
              </div>
              <div>
                <dt>Hostel</dt>
                <dd>
                  <Building2 aria-hidden="true" />
                  <span>
                    {profile.hostel.code} — {profile.hostel.name}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Profile details</dt>
                <dd>
                  <Badge tone={profile.profileComplete ? "success" : "warning"}>
                    {profile.profileComplete ? "Complete" : "Needs details"}
                  </Badge>
                </dd>
              </div>
            </dl>

            <section
              className="hm-profile__allocation"
              aria-labelledby="current-room-title"
            >
              <div className="hm-profile__allocation-icon" aria-hidden="true">
                <BedDouble />
              </div>
              <div>
                <h2 id="current-room-title">Current room</h2>
                {profile.currentAllocation ? (
                  <>
                    <p className="hm-profile__room-label">
                      {profile.currentAllocation.room.label}
                    </p>
                    <p>
                      {profile.currentAllocation.block.name}, floor {profile.currentAllocation.room.floor}
                      {" · "}Allocated {formatResidentDate(profile.currentAllocation.allocatedAt)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="hm-profile__room-label">Not allocated</p>
                    <p>A warden or administrator has not assigned a room yet.</p>
                  </>
                )}
              </div>
            </section>
          </Panel>

          <Panel
            as="form"
            className="hm-profile__form"
            onSubmit={saveProfile}
          >
            <div className="hm-profile__section-heading">
              <div>
                <h2>Contact details</h2>
                <p>All three fields are required for a complete resident profile.</p>
              </div>
              <UserRound aria-hidden="true" />
            </div>

            <div className="hm-profile__form-grid">
              <Input
                ref={phoneRef}
                label="Phone number"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                required
                value={contact.phone}
                error={formErrors.phone}
                onChange={(event) => updateContact("phone", event.target.value)}
              />
              <Input
                ref={guardianNameRef}
                label="Guardian name"
                name="guardianName"
                type="text"
                autoComplete="section-guardian name"
                required
                value={contact.guardianName}
                error={formErrors.guardianName}
                onChange={(event) =>
                  updateContact("guardianName", event.target.value)
                }
              />
              <Input
                ref={guardianPhoneRef}
                label="Guardian phone number"
                name="guardianPhone"
                type="tel"
                autoComplete="section-guardian tel"
                placeholder="+91 98765 43211"
                required
                value={contact.guardianPhone}
                error={formErrors.guardianPhone}
                onChange={(event) =>
                  updateContact("guardianPhone", event.target.value)
                }
              />
            </div>

            {formError && (
              <p className="hm-residents__form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="hm-profile__form-footer">
              <span>Last updated {formatResidentDate(profile.updatedAt)}</span>
              <Button
                type="submit"
                variant="primary"
                size="form"
                leadingIcon={<Save aria-hidden="true" />}
                loading={saving}
                loadingLabel="Saving profile"
                disabled={!hasChanges}
              >
                Save profile
              </Button>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
};

export default StudentProfile;
