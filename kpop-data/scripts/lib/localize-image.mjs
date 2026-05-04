import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const PUBLIC_IMAGE_DIR = process.env.KPOP_IMAGE_ROOT
  ? new URL(`file://${process.env.KPOP_IMAGE_ROOT.replace(/\/$/, "")}/`)
  : new URL("file:///var/www/kpop-data/kpop-images/");
const PUBLIC_IMAGE_URL_PREFIX = "/kpop-images";
const REQUEST_TIMEOUT_MS = 20000;

function timeoutSignal(ms = REQUEST_TIMEOUT_MS) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function sanitizeSegment(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";
}

function extFromContentType(contentType) {
  if (!contentType) return "";
  const lower = contentType.toLowerCase();
  if (lower.includes("image/jpeg")) return ".jpg";
  if (lower.includes("image/png")) return ".png";
  if (lower.includes("image/webp")) return ".webp";
  if (lower.includes("image/gif")) return ".gif";
  if (lower.includes("image/avif")) return ".avif";
  return "";
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = extname(pathname).toLowerCase();
    return ext && ext.length <= 5 ? ext : "";
  } catch {
    return "";
  }
}

function fileStem(url, namespace, idHint) {
  const base = idHint ? sanitizeSegment(idHint) : createHash("sha1").update(url).digest("hex").slice(0, 20);
  return `${sanitizeSegment(namespace)}/${base}`;
}

export async function localizeImage(url, namespace, idHint) {
  if (!url || typeof url !== "string") {
    return "";
  }

  const stem = fileStem(url, namespace, idHint);
  const initialExt = extFromUrl(url) || ".jpg";
  const initialFile = new URL(`./${stem}${initialExt}`, PUBLIC_IMAGE_DIR);

  try {
    const existing = await stat(initialFile);
    if (existing.isFile() && existing.size > 0) {
      return `${PUBLIC_IMAGE_URL_PREFIX}/${stem}${initialExt}`;
    }
  } catch {}

  try {
    const response = await fetch(url, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        referer: "https://ichart.kr/",
      },
      signal: timeoutSignal(),
    });

    if (!response.ok) {
      return url;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const ext = extFromContentType(response.headers.get("content-type")) || initialExt;
    const finalFile = new URL(`./${stem}${ext}`, PUBLIC_IMAGE_DIR);
    await mkdir(new URL(`./${sanitizeSegment(namespace)}/`, PUBLIC_IMAGE_DIR), { recursive: true });
    await writeFile(finalFile, bytes);
    return `${PUBLIC_IMAGE_URL_PREFIX}/${stem}${ext}`;
  } catch {
    return url;
  }
}
