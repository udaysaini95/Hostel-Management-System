import { Button } from "../components/ui/index.js";

const getResultRange = (pagination) => {
  if (pagination.total === 0) {
    return "0 results";
  }

  const first = (pagination.page - 1) * pagination.pageSize + 1;
  const last = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total
  );

  return `${first}–${last} of ${pagination.total}`;
};

export const PaginationControls = ({
  pagination,
  onPageChange,
  disabled = false,
  label = "Results pagination",
}) => (
  <nav className="hm-residents__pagination" aria-label={label}>
    <span>{getResultRange(pagination)}</span>
    <div>
      <Button
        disabled={disabled || pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        Previous
      </Button>
      <Button
        disabled={
          disabled ||
          pagination.totalPages === 0 ||
          pagination.page >= pagination.totalPages
        }
        onClick={() => onPageChange(pagination.page + 1)}
      >
        Next
      </Button>
    </div>
  </nav>
);
