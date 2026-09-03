const EMAIL_CONFIG_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "EMAIL_FROM",
  "STUDENT_ACTIVATION_URL",
];

export class StudentActivationEmailConfigError extends Error {
  constructor(issues) {
    super(`Invalid student activation email configuration:\n- ${issues.join("\n- ")}`);
    this.name = "StudentActivationEmailConfigError";
    this.issues = Object.freeze([...issues]);
  }
}

export const parseStudentActivationEmailConfig = (
  environment = process.env
) => {
  const isConfigured = EMAIL_CONFIG_KEYS.some((key) => environment[key]);

  if (!isConfigured) {
    return Object.freeze({ enabled: false });
  }

  const issues = [];
  const port = Number(environment.SMTP_PORT);
  const requiredValues = [
    ["SMTP_HOST", environment.SMTP_HOST],
    ["SMTP_PORT", environment.SMTP_PORT],
    ["EMAIL_FROM", environment.EMAIL_FROM],
    ["STUDENT_ACTIVATION_URL", environment.STUDENT_ACTIVATION_URL],
  ];

  for (const [name, value] of requiredValues) {
    if (!value) {
      issues.push(`${name} is required when activation email is configured.`);
    }
  }

  if (
    environment.SMTP_PORT &&
    (!Number.isInteger(port) || port < 1 || port > 65535)
  ) {
    issues.push("SMTP_PORT must be an integer between 1 and 65535.");
  }

  if (
    environment.SMTP_SECURE &&
    !["true", "false"].includes(environment.SMTP_SECURE)
  ) {
    issues.push("SMTP_SECURE must be true or false.");
  }

  const hasSmtpUser = Boolean(environment.SMTP_USER);
  const hasSmtpPassword = Boolean(environment.SMTP_PASSWORD);

  if (hasSmtpUser !== hasSmtpPassword) {
    issues.push("SMTP_USER and SMTP_PASSWORD must be provided together.");
  }

  let activationUrl;
  if (environment.STUDENT_ACTIVATION_URL) {
    try {
      activationUrl = new URL(environment.STUDENT_ACTIVATION_URL);
      if (!["http:", "https:"].includes(activationUrl.protocol)) {
        issues.push("STUDENT_ACTIVATION_URL must use HTTP or HTTPS.");
      }
      if (
        environment.NODE_ENV === "production" &&
        activationUrl.protocol !== "https:"
      ) {
        issues.push("STUDENT_ACTIVATION_URL must use HTTPS in production.");
      }
    } catch {
      issues.push("STUDENT_ACTIVATION_URL must be a valid URL.");
    }
  }

  if (issues.length > 0) {
    throw new StudentActivationEmailConfigError(issues);
  }

  return Object.freeze({
    enabled: true,
    host: environment.SMTP_HOST,
    port,
    secure: environment.SMTP_SECURE === "true",
    user: environment.SMTP_USER || null,
    password: environment.SMTP_PASSWORD || null,
    from: environment.EMAIL_FROM,
    activationUrl: activationUrl.toString(),
  });
};

let cachedEmailConfig;

export const getStudentActivationEmailConfig = () => {
  if (!cachedEmailConfig) {
    cachedEmailConfig = parseStudentActivationEmailConfig();
  }

  return cachedEmailConfig;
};
