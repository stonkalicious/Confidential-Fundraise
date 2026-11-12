import { Storage, type File } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

// Only these two first-party assets are exposed. Never resolve private objects here.
export const walkthroughMedia = {
  "walkthrough-589be0760638.mp4": "video/mp4",
  "walkthrough-589be0760638.webp": "image/webp",
} as const;

export type WalkthroughFilename = keyof typeof walkthroughMedia;
export type PublicMediaFile = Pick<File, "getMetadata" | "createReadStream">;

export async function findWalkthroughMedia(
  filename: WalkthroughFilename,
): Promise<PublicMediaFile | null> {
  const roots = [...new Set(
    (process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? "").split(",").map((root) => root.trim()).filter(Boolean),
  )];
  if (!roots.length) throw new Error("Public object storage is not configured");

  for (const root of roots) {
    const [bucketName, ...prefix] = root.replace(/^\/+|\/+$/g, "").split("/");
    if (!bucketName) throw new Error("Invalid public object storage path");
    const objectName = [...prefix, "agent-raised", filename].join("/");
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (exists) return file;
  }
  return null;
}
