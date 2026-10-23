"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { manifestFiles, type CbManifest } from "@/app/_lib/coursebook-types";

const TYPES: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  pdf: "application/pdf",
  json: "application/json",
};
const typeOf = (path: string) => TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
const baseName = (path: string) => path.split("/").pop() ?? path;

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `v${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function explain(message: string) {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) return 'The "media" storage bucket does not exist yet. Create it in Supabase → Storage, and keep it private.';
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403"))
    return "This account is not allowed to add course files. Sign in with an administrator account and try again.";
  if (m.includes("mime") || m.includes("content type"))
    return 'The "media" bucket only accepts some file types. In Supabase → Storage → media → Edit bucket, clear "Allowed MIME types", then upload again.';
  if (m.includes("payload too large") || m.includes("maximum allowed size"))
    return 'A file is larger than the "media" bucket allows. Raise the bucket\'s file size limit in Supabase → Storage, then upload again.';
  return message;
}

/**
 * Adds the coursebook files to private storage. Every upload goes into a new
 * version folder, with manifest.json written last, so students keep seeing the
 * previous coursebook until the new one is complete.
 */
export default function CoursebookUpload({ courseId }: { courseId: string }) {
  const router = useRouter();
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ manifest: CbManifest; manifestFile: File; files: Map<string, File> } | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [finished, setFinished] = useState(false);

  async function choose(list: FileList | null) {
    setError(null);
    setPicked(null);
    setMissing([]);
    setFinished(false);
    setDone(0);
    const files = new Map<string, File>();
    Array.from(list ?? []).forEach((f) => files.set(f.name, f));
    const manifestFile = files.get("manifest.json");
    if (!manifestFile) {
      setError('There is no manifest.json in what you chose. Choose the "coursebook" folder from the download.');
      return;
    }
    let manifest: CbManifest;
    try {
      manifest = JSON.parse(await manifestFile.text());
      if (!Array.isArray(manifest.pages) || !manifest.pages.length) throw new Error();
    } catch {
      setError("manifest.json could not be read. Download the coursebook folder again and choose it here.");
      return;
    }
    setMissing(manifestFiles(manifest).filter((p) => !files.has(baseName(p))));
    setPicked({ manifest, manifestFile, files });
  }

  async function upload() {
    if (!picked || missing.length) return;
    setBusy(true);
    setError(null);
    setDone(0);
    const store = browserClient().storage.from("media");
    const base = `${courseId}/coursebook/${stamp()}`;
    const jobs = manifestFiles(picked.manifest).map((p) => ({ path: `${base}/${p}`, file: picked.files.get(baseName(p))! }));
    let next = 0;
    let failure: string | null = null;
    const worker = async () => {
      while (next < jobs.length && !failure) {
        const job = jobs[next++];
        const { error: err } = await store.upload(job.path, job.file, {
          contentType: typeOf(job.path),
          cacheControl: "31536000",
          upsert: false,
        });
        if (err) failure = err.message;
        else setDone((d) => d + 1);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (!failure) {
      const { error: err } = await store.upload(`${base}/manifest.json`, picked.manifestFile, {
        contentType: "application/json",
        upsert: false,
      });
      if (err) failure = err.message;
    }
    setBusy(false);
    if (failure) {
      setError(explain(failure));
      return;
    }
    setFinished(true);
    router.refresh();
  }

  const needed = picked ? manifestFiles(picked.manifest).length : 0;
  const tracks = picked ? Object.keys(picked.manifest.tracks).length : 0;

  return (
    <div className="card">
      <h3>Upload the coursebook</h3>
      <p className="small muted" style={{ margin: "4px 0 12px" }}>
        Unzip the coursebook download on your computer, then choose its <b>coursebook</b> folder. Students see the new
        pages as soon as the upload finishes.
      </p>
      <div className="row">
        <button type="button" className="btn" onClick={() => folderInput.current?.click()} disabled={busy}>
          Choose the coursebook folder
        </button>
        <button type="button" className="btn ghost sm" onClick={() => filesInput.current?.click()} disabled={busy}>
          or choose the files
        </button>
      </div>
      <input
        ref={folderInput}
        type="file"
        hidden
        multiple
        {...({ webkitdirectory: "", directory: "" } as any)}
        onChange={(e) => choose(e.target.files)}
      />
      <input ref={filesInput} type="file" hidden multiple onChange={(e) => choose(e.target.files)} />

      {picked && (
        <div style={{ marginTop: 14 }}>
          <p className="small">
            <b>{picked.manifest.pages.length} pages</b>, <b>{tracks} audio tracks</b> and the PDF ({needed + 1} files).
          </p>
          {missing.length > 0 ? (
            <div className="err" style={{ marginTop: 8 }}>
              {missing.length} file{missing.length === 1 ? " is" : "s are"} missing from the folder: {missing.slice(0, 6).map(baseName).join(", ")}
              {missing.length > 6 ? " …" : ""}. Choose the complete folder.
            </div>
          ) : finished ? (
            <div className="note" style={{ marginTop: 8 }}>
              Uploaded. <a href="/coursebook">Open the coursebook</a> to check it.
            </div>
          ) : (
            <>
              {busy && (
                <div className="cbu-progress" aria-live="polite">
                  <i style={{ width: `${Math.round((done / Math.max(1, needed)) * 100)}%` }} />
                  <span className="tiny muted">
                    {done} of {needed} files
                  </span>
                </div>
              )}
              <button type="button" className="btn gold" style={{ marginTop: 10 }} onClick={upload} disabled={busy}>
                {busy ? "Uploading…" : "Upload to the Studio"}
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <div className="err" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}
