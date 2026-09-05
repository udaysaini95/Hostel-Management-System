import { Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { joinClassNames } from "../components/ui/classNames.js";

export const ProductBrand = ({ to = "/", compact = false, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={joinClassNames(
      "hm-product-brand",
      compact && "hm-product-brand--compact"
    )}
    aria-label="HostelMate home"
  >
    <span className="hm-product-brand__mark" aria-hidden="true">
      <Building2 />
    </span>
    <span className="hm-product-brand__name">HostelMate</span>
  </Link>
);
