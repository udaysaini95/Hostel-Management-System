import { joinClassNames } from "./classNames.js";

export const Table = ({
  caption,
  hideCaption = false,
  className,
  wrapperClassName,
  children,
  ...props
}) => (
  <div className={joinClassNames("hm-table-wrap", wrapperClassName)}>
    <table {...props} className={joinClassNames("hm-table", className)}>
      {caption && (
        <caption className={hideCaption ? "hm-visually-hidden" : undefined}>
          {caption}
        </caption>
      )}
      {children}
    </table>
  </div>
);

export const TableHead = (props) => <thead {...props} />;
export const TableBody = (props) => <tbody {...props} />;
export const TableRow = (props) => <tr {...props} />;

export const TableHeaderCell = ({ scope = "col", ...props }) => (
  <th {...props} scope={scope} />
);

export const TableCell = ({ numeric = false, actions = false, ...props }) => (
  <td
    {...props}
    className={joinClassNames(
      numeric && "hm-table__numeric",
      actions && "hm-table__actions",
      props.className
    )}
  />
);
