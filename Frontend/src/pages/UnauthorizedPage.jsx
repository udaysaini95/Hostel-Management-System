import { ShieldX } from "lucide-react";
import { ButtonLink, Panel } from "../components/ui/index.js";
import { useAuth } from "../auth/authContext.js";
import { getRoleHome, ROLE_LABELS } from "../layouts/navigation.js";

const UnauthorizedPage = () => {
  const { user } = useAuth();
  const roleLabel = ROLE_LABELS[user.role] || "current";

  return (
    <div className="hm-page-stack hm-page-stack--narrow">
      <Panel className="hm-route-message" aria-labelledby="access-denied-title">
        <span className="hm-route-message__icon" aria-hidden="true">
          <ShieldX />
        </span>
        <p className="hm-route-message__eyebrow">Access control</p>
        <h1 id="access-denied-title">You do not have access to this page</h1>
        <p>
          This destination is not available to your {roleLabel.toLowerCase()} account.
          Use your workspace navigation to continue.
        </p>
        <div className="hm-route-message__actions">
          <ButtonLink to={getRoleHome(user.role)} variant="primary">
            Return to your workspace
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
};

export default UnauthorizedPage;
