import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export const getFocusableElements = (container) => {
  if (!container?.querySelectorAll) {
    return [];
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute?.("aria-hidden") !== "true"
  );
};

export const handleFocusTrapKeyDown = (
  event,
  container,
  onDismiss = () => {}
) => {
  if (event.key === "Escape") {
    event.preventDefault();
    onDismiss();
    return;
  }

  if (event.key !== "Tab" || !container) {
    return;
  }

  const focusableElements = getFocusableElements(container);

  if (focusableElements.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);
  const activeElement = container.ownerDocument?.activeElement;
  const focusIsOutside = !container.contains(activeElement);

  if (event.shiftKey && (activeElement === firstElement || focusIsOutside)) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && (activeElement === lastElement || focusIsOutside)) {
    event.preventDefault();
    firstElement.focus();
  }
};

export const useFocusTrap = ({ open, onDismiss }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previouslyFocusedElement = document.activeElement;
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const animationFrame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      const preferredElement = container?.querySelector("[data-autofocus]");
      const firstFocusableElement = getFocusableElements(container)[0];

      (preferredElement || firstFocusableElement || container)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = originalBodyOverflow;

      if (previouslyFocusedElement?.focus) {
        previouslyFocusedElement.focus();
      }
    };
  }, [open]);

  const handleKeyDown = (event) => {
    handleFocusTrapKeyDown(event, containerRef.current, onDismiss);
  };

  return { containerRef, handleKeyDown };
};
