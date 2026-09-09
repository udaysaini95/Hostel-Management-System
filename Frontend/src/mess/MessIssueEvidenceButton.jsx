import { useState } from "react";
import { Paperclip } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import { Button } from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import { getMessIssueEvidenceBlob } from "./messApi.js";

export const MessIssueEvidenceButton = ({ issue }) => {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  if (!issue.evidence) return null;

  const downloadEvidence = async () => {
    try {
      setLoading(true);
      const blob = await getMessIssueEvidenceBlob(issue.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = issue.evidence.originalName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Evidence could not be downloaded",
        message: getApiErrorMessage(error, "Try again in a moment."),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      loading={loading}
      loadingLabel="Downloading evidence"
      onClick={downloadEvidence}
    >
      <Paperclip aria-hidden="true" /> View evidence
    </Button>
  );
};
