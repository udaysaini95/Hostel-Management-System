import { ErrorState, LoadingState } from "../components/ui/index.js";

export const DashboardState = ({ loading, error, onRetry }) => {
  if (loading) {
    return <LoadingState label="Loading dashboard" rows={4} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        description={error}
        onRetry={onRetry}
      />
    );
  }

  return null;
};
