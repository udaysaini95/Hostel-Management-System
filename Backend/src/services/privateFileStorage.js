import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultStorageRoot = fileURLToPath(
  new URL("../../private-storage/", import.meta.url)
);
const publicUploadsRoot = fileURLToPath(
  new URL("../../uploads/", import.meta.url)
);

const normalizeStorageKey = (storageKey) => {
  const key = typeof storageKey === "string" ? storageKey.trim() : "";
  const segments = key.split("/");

  if (
    !key ||
    key.includes("\\") ||
    key.includes("\0") ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    !/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key)
  ) {
    throw new Error("Private storage key is invalid");
  }

  return segments;
};

const resolveStoragePath = (rootDirectory, storageKey) => {
  const root = resolve(rootDirectory);
  const target = resolve(root, ...normalizeStorageKey(storageKey));
  const pathFromRoot = relative(root, target);

  if (
    !pathFromRoot ||
    pathFromRoot.startsWith("..") ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error("Private storage key is outside the storage root");
  }

  return target;
};

export const createPrivateFileStorage = ({
  rootDirectory =
    process.env.PRIVATE_FILE_STORAGE_PATH?.trim() || defaultStorageRoot,
} = {}) => {
  const storageRoot = resolve(rootDirectory);
  const pathFromPublicUploads = relative(resolve(publicUploadsRoot), storageRoot);
  const isPubliclyExposed =
    !pathFromPublicUploads.startsWith("..") &&
    !isAbsolute(pathFromPublicUploads);

  if (isPubliclyExposed) {
    throw new Error(
      "Private storage cannot be inside the public uploads directory"
    );
  }

  return {
    async write(storageKey, contents) {
      const target = resolveStoragePath(storageRoot, storageKey);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents, { flag: "wx" });
    },

    async read(storageKey) {
      return readFile(resolveStoragePath(storageRoot, storageKey));
    },

    async remove(storageKey) {
      await rm(resolveStoragePath(storageRoot, storageKey), { force: true });
    },
  };
};

export const privateFileStorage = createPrivateFileStorage();
