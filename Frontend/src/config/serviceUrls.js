const SUPPORTED_SERVICE_PROTOCOLS = new Set(["http:", "https:"]);

export class FrontendConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "FrontendConfigurationError";
  }
}

const normalizeServiceOrigin = (value, variableName) => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new FrontendConfigurationError(`${variableName} must be a URL.`);
  }

  if (!value.trim()) {
    return "";
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(value.trim());
  } catch {
    throw new FrontendConfigurationError(`${variableName} must be a valid URL.`);
  }

  const hasUnsupportedParts =
    !SUPPORTED_SERVICE_PROTOCOLS.has(parsedUrl.protocol) ||
    parsedUrl.pathname !== "/" ||
    Boolean(
      parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.search ||
        parsedUrl.hash
    );

  if (hasUnsupportedParts) {
    throw new FrontendConfigurationError(
      `${variableName} must contain only an HTTP(S) origin.`
    );
  }

  return parsedUrl.origin;
};

export const createServiceUrlConfig = (environment = {}) => {
  const apiBaseUrl = normalizeServiceOrigin(
    environment.VITE_API_BASE_URL,
    "VITE_API_BASE_URL"
  );
  const configuredAssetBaseUrl = environment.VITE_ASSET_BASE_URL;
  const hasConfiguredAssetBaseUrl =
    configuredAssetBaseUrl !== undefined &&
    configuredAssetBaseUrl !== null &&
    (typeof configuredAssetBaseUrl !== "string" ||
      Boolean(configuredAssetBaseUrl.trim()));
  const assetBaseUrl = hasConfiguredAssetBaseUrl
    ? normalizeServiceOrigin(configuredAssetBaseUrl, "VITE_ASSET_BASE_URL")
    : apiBaseUrl;

  return Object.freeze({ apiBaseUrl, assetBaseUrl });
};

const encodeAssetPath = (path) => {
  if (typeof path !== "string" || !path.trim()) {
    return null;
  }

  const normalizedPath = path.trim().replaceAll("\\", "/");
  const isExternalReference =
    normalizedPath.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(normalizedPath);

  if (isExternalReference) {
    return null;
  }

  const segments = normalizedPath.split("/").filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }

  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
};

export const buildAssetUrl = (
  path,
  assetBaseUrl = frontendServiceConfig.assetBaseUrl
) => {
  const encodedPath = encodeAssetPath(path);

  return encodedPath ? `${assetBaseUrl}${encodedPath}` : null;
};

export const buildUploadUrl = (
  fileReference,
  assetBaseUrl = frontendServiceConfig.assetBaseUrl
) => {
  if (typeof fileReference !== "string") {
    return null;
  }

  const rawReference = fileReference.trim().replaceAll("\\", "/");
  const isExternalReference =
    rawReference.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(rawReference);

  if (!rawReference || isExternalReference) {
    return null;
  }

  const normalizedReference = rawReference
    .replace(/^\/+/, "")
    .replace(/^uploads\//i, "");

  if (!normalizedReference) {
    return null;
  }

  return buildAssetUrl(`uploads/${normalizedReference}`, assetBaseUrl);
};

export const frontendServiceConfig = createServiceUrlConfig(
  import.meta.env ?? {}
);
