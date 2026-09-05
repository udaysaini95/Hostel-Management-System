import { FileQuestion } from "lucide-react";
import { useAuth } from "../auth/authContext.js";
import { AUTH_STATUS } from "../auth/session.js";
import { ButtonLink, Panel } from "../components/ui/index.js";
import { getRoleHome } from "../layouts/navigation.js";

const NotFoundPage = () => {
  const { status, user } = useAuth();
  const isSignedIn = status === AUTH_STATUS.AUTHENTICATED;
  const destination = isSignedIn ? getRoleHome(user.role) : "/";

  return (
    <div className="hm-public-status-page">
      <Panel className="hm-route-message" aria-labelledby="not-found-title">
        <span className="hm-route-message__icon" aria-hidden="true">
          <FileQuestion />
        </span>
        <p className="hm-route-message__eyebrow">Error 404</p>
        <h1 id="not-found-title">This page does not exist</h1>
        <p>
          The address may be incorrect, or the page may have moved to a different
          part of HostelMate.
        </p>
        <div className="hm-route-message__actions">
          <ButtonLink to={destination} variant="primary">
            {isSignedIn ? "Return to your workspace" : "Return to home"}
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
};

export default NotFoundPage;
