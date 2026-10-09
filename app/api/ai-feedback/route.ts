import { NextResponse } from "next/server";
import { currentProfile, serverClient, adminClient } from "@/app/_lib/supabase";
import { RUBRIC } from "@/app/_lib/rubric";

/**
 * AI feedback on one recording.
 *
 * The free way (the default): GET returns a ready-written request; the student
 * pastes it into any free assistant (Claude, ChatGPT, Gemini…) and sends the
 * reply back with POST { submissionId, reply }. Nothing is paid for.
 *
 * The automatic way (optional, paid per use): if ANTHROPIC_API_KEY is set in
 * the hosting settings, POST { submissionId } asks Claude directly. Leave the
 * key unset to keep the academy free of charge.
 *
 * Everything the route READS goes through the viewer's own client, so access
 * rules decide what they may see. The single WRITE uses the server key,
 * because feedback labelled "ai" cannot be written by any signed-in user.
 */

const MODEL = process.env.AI_FEEDBACK_MODEL || "claude-sonnet-5-5";

type Loaded =
  | { error: string; status: number }
  | { prompt: string; submissionId: string };

async function load(submissionId: string | null): Promise<Loaded> {
  const profile = await currentProfile();
  if (!profile) return { error: "Not signed in.", status: 401 };
  if (!submissionId) return { error: "No recording given.", status: 400 };

  const supabase = serverClient();
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, student_id, transcript, duration_seconds, lessons(title, body, target_seconds)")
    .eq("id", submissionId)
    .single();

  if (!sub) return { error: "That recording could not be found.", status: 404 };
  if (sub.student_id !== profile.id && profile.role === "student") {
    return { error: "That is not your recording.", status: 403 };
  }
  if (!sub.transcript?.trim()) return { error: "There is no transcript to work from.", status: 400 };

  const { data: peer } = await supabase
    .from("feedback")
    .select("source, scores, strengths, improve")
    .eq("submission_id", submissionId)
    .in("source", ["peer", "teacher"]);

  if (!peer?.length) {
    return { error: "Classmate feedback comes first. Share this recording and ask a classmate to score it.", status: 400 };
  }

  const { data: existing } = await supabase
    .from("feedback")
    .select("id")
    .eq("submission_id", submissionId)
    .eq("source", "ai")
    .maybeSingle();
  if (existing) return { error: "This attempt already has AI feedback.", status: 409 };

  const lesson = (sub as any).lessons;
  const target = lesson?.target_seconds ?? 120;
  const actual = sub.duration_seconds ?? 0;
  const diff = actual - target;
  const timing =
    Math.abs(diff) <= target * 0.15 ? "within target" : diff > 0 ? `over by ${diff} seconds` : `under by ${-diff} seconds`;

  const prompt = `You are an EAP tutor giving feedback on a B2-level undergraduate's recorded practice presentation in English.

ACTIVITY: ${lesson?.title ?? "practice task"}
TASK SET: ${(lesson?.body ?? "").slice(0, 1200)}
TARGET LENGTH: ${target} seconds. ACTUAL: ${actual} seconds (${timing}).

TRANSCRIPT (automatic speech-to-text, so expect transcription errors; judge the speaking, not the spelling):
"""${sub.transcript.slice(0, 8000)}"""

FEEDBACK ALREADY GIVEN BY A CLASSMATE OR TEACHER:
${JSON.stringify(peer)}

RUBRIC — score each criterion 1 to 4:
${RUBRIC.map((c) => `${c.n}. ${c.name} [id: ${c.id}]\n  4 = ${c.l4}\n  3 = ${c.l3}\n  2 = ${c.l2}\n  1 = ${c.l1}`).join("\n\n")}

Rules:
- Judge only what a transcript and timing can show: wording, structure, signposting, source acknowledgement, timing, pace, fillers, repetition. Never claim to judge eye contact, posture or gestures; where a criterion depends on those, score what is audible and say in the action what a classmate should watch for.
- Quote or paraphrase a short specific moment from the transcript as evidence.
- Build on the earlier feedback where it agrees; say plainly where your reading differs.
- Be encouraging but honest. A 4 must be earned.

Reply with ONLY this JSON and nothing else:
{"scores":{"intro":1-4,"organization":1-4,"delivery":1-4,"language":1-4,"conclusion":1-4},
 "strengths":"what worked, quoting the transcript, 2-3 sentences",
 "improve":"the single most useful change, one sentence addressed to you"}`;

  return { prompt, submissionId };
}

/** Pulls the scores out of an assistant's reply, however it was wrapped. */
function parseReply(text: string) {
  const clean = String(text).replace(/```json/gi, "```").split("```").join(" ");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  let data: any;
  try {
    data = JSON.parse(clean.slice(start, end + 1));
  } catch {
    return null;
  }
  const scores: Record<string, number> = {};
  for (const c of RUBRIC) {
    const v = Math.round(Number(data?.scores?.[c.id]));
    if (v >= 1 && v <= 4) scores[c.id] = v;
  }
  if (!Object.keys(scores).length) return null;
  return {
    scores,
    strengths: String(data.strengths ?? "").slice(0, 2000) || null,
    improve: String(data.improve ?? "").slice(0, 2000) || null,
  };
}

async function save(submissionId: string, parsed: NonNullable<ReturnType<typeof parseReply>>) {
  const { error } = await adminClient().from("feedback").insert({
    submission_id: submissionId,
    author_id: null,
    source: "ai",
    ...parsed,
  });
  if (error) {
    console.error("ai-feedback insert", error);
    return NextResponse.json({ error: "The feedback could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** The ready-written request, for the free copy-and-paste way. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("submissionId");
  const r = await load(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ prompt: r.prompt });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const r = await load(body?.submissionId ?? null);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  // the free way: the student pasted an assistant's reply
  if (typeof body?.reply === "string") {
    const parsed = parseReply(body.reply);
    if (!parsed) {
      return NextResponse.json(
        { error: "That reply could not be read as scores. Ask the assistant to reply with only the JSON, then paste it again." },
        { status: 400 }
      );
    }
    return save(r.submissionId, parsed);
  }

  // the automatic way, only if the academy has chosen to pay for it
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Automatic AI feedback is switched off. Use the copy-and-paste steps." }, { status: 503 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: "user", content: r.prompt }] }),
    });
    if (!res.ok) {
      console.error("anthropic error", res.status, (await res.text()).slice(0, 400));
      return NextResponse.json({ error: `The feedback service returned ${res.status}.` }, { status: 502 });
    }
    const out = await res.json();
    const parsed = parseReply(out.content?.[0]?.text ?? "");
    if (!parsed) return NextResponse.json({ error: "The reply could not be read as scores. Try again." }, { status: 502 });
    return save(r.submissionId, parsed);
  } catch (e) {
    console.error("ai-feedback", e);
    return NextResponse.json({ error: "The feedback service could not be reached." }, { status: 502 });
  }
}
