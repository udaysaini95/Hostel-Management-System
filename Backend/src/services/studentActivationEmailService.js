import nodemailer from "nodemailer";

export const buildStudentActivationEmail = (config, activation) => {
  const url = new URL(config.activationUrl);
  url.searchParams.set("token", activation.token);

  return {
    from: config.from,
    to: activation.email,
    subject: "Activate your HostelMate student account",
    text: [
      `Hello ${activation.name},`,
      "",
      "Your student record has been approved for HostelMate.",
      `Activate your account within 30 minutes: ${url.toString()}`,
      "",
      "If you did not request this email, you can ignore it.",
    ].join("\n"),
  };
};

export const sendStudentActivationEmail = async (config, activation) => {
  const transportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
  };

  if (config.user) {
    transportOptions.auth = {
      user: config.user,
      pass: config.password,
    };
  }

  const transport = nodemailer.createTransport(transportOptions);
  await transport.sendMail(buildStudentActivationEmail(config, activation));
};
