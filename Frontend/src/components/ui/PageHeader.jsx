import { joinClassNames } from "./classNames.js";

export const PageHeader = ({
  title,
  description,
  eyebrow,
  actions,
  className,
}) => (
  <header className={joinClassNames("hm-page-header", className)}>
    <div className="hm-page-header__copy">
      {eyebrow && <p className="hm-page-header__eyebrow">{eyebrow}</p>}
      <h1 className="hm-page-header__title">{title}</h1>
      {description && (
        <p className="hm-page-header__description">{description}</p>
      )}
    </div>
    {actions && <div className="hm-page-header__actions">{actions}</div>}
  </header>
);
