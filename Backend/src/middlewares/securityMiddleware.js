import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ApiError } from "../utils/apiErrors.js";

export const JSON_BODY_LIMIT = "100kb";

export const createCorsOptions = (allowedOrigins) => {
  const originAllowlist = new Set(allowedOrigins);

  return {
    origin(origin, callback) {
      // Requests without Origin include server-to-server calls and command-line clients.
      if (!origin || originAllowlist.has(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new ApiError(
          403,
          "CORS_ORIGIN_DENIED",
          "This web origin is not allowed to access the API"
        )
      );
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    exposedHeaders: ["RateLimit", "RateLimit-Policy", "Retry-After"],
    maxAge: 24 * 60 * 60,
  };
};

export const applySecurityMiddleware = (app, runtimeConfig) => {
  const trustProxy =
    runtimeConfig.trustProxyHops > 0 ? runtimeConfig.trustProxyHops : false;

  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);

  app.use(
    helmet({
      // Uploaded images currently come from the API origin and are viewed by the UI.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(cors(createCorsOptions(runtimeConfig.corsAllowedOrigins)));
  app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));
};
