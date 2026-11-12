import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { RaiseSnapshotUnavailableError } from "./lib/raise-store";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const raiseReadErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (!(error instanceof RaiseSnapshotUnavailableError)) {
    next(error);
    return;
  }
  req.log.warn("Could not refresh raise details");
  res.set("Cache-Control", "no-store").status(503).json({ error: error.message });
};
app.use(raiseReadErrorHandler);

const apiBodyErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const isApiRequest =
    req.originalUrl === "/api" || req.originalUrl.startsWith("/api/");
  const isMalformedJson =
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed" &&
    "status" in error &&
    error.status === 400;

  if (!isApiRequest || !isMalformedJson) {
    next(error);
    return;
  }

  req.log.warn("Rejected malformed JSON request body");
  res
    .set("Cache-Control", "no-store")
    .status(400)
    .json({ error: "Malformed JSON request body." });
};
app.use(apiBodyErrorHandler);

export default app;
