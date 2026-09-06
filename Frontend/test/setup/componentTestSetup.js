import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

window.requestAnimationFrame = (callback) => {
  callback(performance.now());
  return 1;
};

window.cancelAnimationFrame = () => {};
