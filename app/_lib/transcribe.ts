/**
 * Speech-to-text on the student's own device, for browsers where live speech
 * recognition cannot run alongside the recorder (iPad, iPhone, Safari,
 * Firefox). It uses Whisper through transformers.js in a background worker:
 * free, nothing is sent to a server, and the model (about 75 MB) is
 * downloaded once and then kept by the browser.
 */

const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js";
const MODEL = "onnx-community/whisper-base.en";
const RATE = 16000; // Whisper listens at 16 kHz

const WORKER = `
import { pipeline, env } from "${LIB}";
env.allowLocalModels = false;
let asr = null;
const files = {};
self.onmessage = async (e) => {
  try {
    if (!asr) {
      asr = await pipeline("automatic-speech-recognition", "${MODEL}", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p) => {
          if (p.status === "progress" && p.file) {
            files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
            let loaded = 0, total = 0;
            for (const k in files) { loaded += files[k].loaded; total += files[k].total; }
            self.postMessage({ type: "download", loaded, total });
          }
        },
      });
    }
    self.postMessage({ type: "working" });
    const out = await asr(e.data.audio, { chunk_length_s: 30, stride_length_s: 5 });
    const text = Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text;
    // drop markers such as [BLANK_AUDIO] or (music) that Whisper writes for non-speech
    const clean = (text || "").replace(/\\[[^\\]]*\\]|\\([^)]*\\)/g, " ").replace(/\\s+/g, " ").trim();
    self.postMessage({ type: "done", text: clean });
  } catch (err) {
    self.postMessage({ type: "error", message: String((err && err.message) || err) });
  }
};
`;

let worker: Worker | null = null;

function getWorker() {
  if (!worker) {
    const url = URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" }));
    worker = new Worker(url, { type: "module" });
  }
  return worker;
}

/** Decodes the recording and turns it into 16 kHz mono samples. */
async function toSamples(blob: Blob): Promise<Float32Array> {
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctx();
  try {
    const buf = await new Promise<AudioBuffer>((resolve, reject) => {
      blob.arrayBuffer().then((ab) => {
        // the callback form is the one older Safari understands
        const p = ctx.decodeAudioData(ab, resolve, reject);
        if (p && typeof (p as any).catch === "function") (p as any).catch(reject);
      }, reject);
    });
    // mix to mono
    const len = buf.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += d[i] / buf.numberOfChannels;
    }
    if (buf.sampleRate === RATE) return mono;
    // resample by linear interpolation
    const ratio = buf.sampleRate / RATE;
    const out = new Float32Array(Math.floor(len / ratio));
    for (let i = 0; i < out.length; i++) {
      const x = i * ratio;
      const j = Math.floor(x);
      const f = x - j;
      out[i] = mono[j] * (1 - f) + (mono[j + 1] ?? mono[j]) * f;
    }
    return out;
  } finally {
    try { await ctx.close(); } catch {}
  }
}

export type TranscribeStatus =
  | { stage: "download"; percent: number }
  | { stage: "working" };

/** Turns a recording into text on this device. Rejects if the browser cannot do it. */
export async function transcribeOnDevice(blob: Blob, onStatus?: (s: TranscribeStatus) => void): Promise<string> {
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
    throw new Error("This browser cannot transcribe on the device.");
  }
  const audio = await toSamples(blob);
  const w = getWorker();
  return new Promise<string>((resolve, reject) => {
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "download") {
        onStatus?.({ stage: "download", percent: m.total ? Math.min(100, Math.round((100 * m.loaded) / m.total)) : 0 });
      } else if (m.type === "working") {
        onStatus?.({ stage: "working" });
      } else if (m.type === "done") {
        resolve(m.text);
      } else if (m.type === "error") {
        // start afresh next time
        try { w.terminate(); } catch {}
        worker = null;
        reject(new Error(m.message));
      }
    };
    w.onerror = (e) => {
      try { w.terminate(); } catch {}
      worker = null;
      reject(new Error(e.message || "The transcriber could not start."));
    };
    w.postMessage({ audio }, [audio.buffer]);
  });
}
