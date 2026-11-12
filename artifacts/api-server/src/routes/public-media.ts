import { Router, type IRouter } from "express";
import { pipeline } from "node:stream";
import { GetWalkthroughMediaParams } from "@workspace/api-zod";
import {
  findWalkthroughMedia,
  walkthroughMedia,
  type PublicMediaFile,
  type WalkthroughFilename,
} from "../lib/public-media";

// Single ranges cover native video players, including open-ended and suffix requests.
export function parseByteRange(value: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export function createPublicMediaRouter(
  resolveFile: (filename: WalkthroughFilename) => Promise<PublicMediaFile | null> = findWalkthroughMedia,
): IRouter {
  const router = Router();
  router.get("/storage/public-objects/agent-raised/:filename", async (req, res): Promise<void> => {
    const params = GetWalkthroughMediaParams.safeParse(req.params);
    if (!params.success) {
      res.status(404).json({ error: "Public media not found." });
      return;
    }
    try {
      const file = await resolveFile(params.data.filename);
      if (!file) {
        res.status(404).json({ error: "Public media not found." });
        return;
      }
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size);
      if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Invalid media size");
      const etag = metadata.etag ? `"${metadata.etag.replaceAll('"', "")}"` : undefined;
      const modified = metadata.updated ? new Date(metadata.updated).toUTCString() : undefined;
      const ifRange = req.get("If-Range");
      const rangeHeader = req.get("Range");
      const useRange = rangeHeader && (!ifRange || ifRange === etag || ifRange === modified);
      const range = useRange ? parseByteRange(rangeHeader, size) : { start: 0, end: size - 1 };
      if (!range) {
        res.set({ "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" }).status(416).end();
        return;
      }
      res.set({
        "Content-Type": walkthroughMedia[params.data.filename],
        "Content-Length": String(range.end - range.start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      });
      if (etag) res.set("ETag", etag);
      if (modified) res.set("Last-Modified", modified);
      if (useRange) res.status(206).set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
      // Express handles HEAD through GET too; do not read the object for HEAD.
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      pipeline(file.createReadStream({ start: range.start, end: range.end }), res, (error) => {
        if (error && !req.destroyed) req.log?.warn("Public walkthrough stream interrupted");
      });
    } catch {
      req.log?.warn("Public walkthrough media could not be loaded");
      if (!res.headersSent) {
        res.removeHeader("Content-Length");
        res.set("Cache-Control", "no-store").type("application/json").status(503).json({ error: "Walkthrough media is temporarily unavailable." });
      } else {
        res.destroy();
      }
    }
  });
  return router;
}

export default createPublicMediaRouter();
