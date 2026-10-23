import "server-only";
import { serverClient } from "./supabase";
import { manifestFiles, type CbManifest } from "./coursebook-types";

const BUCKET = "media";
const SIGNED_FOR = 6 * 60 * 60; // seconds a signed link stays valid
const REUSE_FOR = 3 * 60 * 60 * 1000; // reuse links while they have at least this long left, so browsers can cache the pages

export const bookDir = (courseId: string) => `${courseId}/coursebook`;

// An uploaded version never changes, so its manifest can be kept once read. Signed
// links are kept for a few hours: the same links on every visit let the browser
// reuse the page images instead of downloading them again. Both are only handed
// out after the visitor's own storage listing has shown they may read the course.
const manifests = new Map<string, CbManifest>();
const signed = new Map<string, { until: number; urls: Map<string, string> }>();

/**
 * The newest complete coursebook upload for a course, as the signed-in person
 * may read it (the storage rules on "media" decide). A version counts once its
 * manifest.json is there: the upload screen writes that file last.
 */
export async function latestCoursebook(courseId: string): Promise<{ version: string; manifest: CbManifest } | null> {
  const store = serverClient().storage.from(BUCKET);
  const dir = bookDir(courseId);
  const { data: entries } = await store.list(dir, { limit: 200 });
  const versions = (entries ?? [])
    .map((e) => e.name)
    .filter((n) => /^v\d{8}-\d{6}$/.test(n))
    .sort()
    .reverse();
  for (const version of versions.slice(0, 5)) {
    const key = `${dir}/${version}`;
    const kept = manifests.get(key);
    if (kept) return { version, manifest: kept };
    const { data: blob } = await store.download(`${key}/manifest.json`);
    if (!blob) continue;
    try {
      const manifest = JSON.parse(await blob.text()) as CbManifest;
      if (Array.isArray(manifest.pages) && manifest.pages.length) {
        manifests.set(key, manifest);
        return { version, manifest };
      }
    } catch {
      // a damaged manifest: try the previous upload
    }
  }
  return null;
}

/** The same coursebook with every file path swapped for a signed link. */
export async function signedCoursebook(courseId: string): Promise<{ version: string; book: CbManifest } | null> {
  const found = await latestCoursebook(courseId);
  if (!found) return null;
  const { version, manifest } = found;
  const base = `${bookDir(courseId)}/${version}/`;
  const files = manifestFiles(manifest);

  let entry = signed.get(base);
  if (!entry || entry.until - Date.now() < REUSE_FOR) {
    const { data } = await serverClient().storage.from(BUCKET).createSignedUrls(files.map((f) => base + f), SIGNED_FOR);
    const urls = new Map<string, string>();
    (data ?? []).forEach((s, i) => {
      if (s.signedUrl) urls.set(files[i], s.signedUrl);
    });
    entry = { until: Date.now() + SIGNED_FOR * 1000, urls };
    if (urls.size === files.length) signed.set(base, entry);
  }
  const urls = entry.urls;
  const sign = (f: string) => urls.get(f) ?? "";
  const book: CbManifest = {
    ...manifest,
    pages: manifest.pages.map((p) => ({ ...p, img: sign(p.img) })),
    tracks: Object.fromEntries(Object.entries(manifest.tracks).map(([k, t]) => [k, { ...t, src: sign(t.src) }])),
    pdf: sign(manifest.pdf),
  };
  return { version, book };
}
