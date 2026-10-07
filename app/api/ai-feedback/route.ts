import { NextResponse } from "next/server";
import { currentProfile, serverClient, adminClient } from "@/app/_lib/supabase";
import { RUBRIC } from "@/app/_lib/rubric";

/**
 * Generates AI feedback on one submission and stores it.
 *
 * The write uses the service role, because `source = 'ai'` is deliberately
 * not grantable to any signed-in user — that is what stops a student forging
 * an AI score. Everything the route READS goes through the viewer's own
 * client, so row-level security still decides what they may see: a student
 * cannot request feedback on a submission they have no access to.
 */
export async function POST(request: Request) {
  const profile = await currentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "AI feedback is not configured. Add ANTHROPIC_API_KEY to the project's environment variables in Vercel.",
      },
      { status: 503 }
    );
  }

  const { submissionId } = await request.json().catch(() => ({ submissionId: null }));
  if (!submissionId) {
    return NextResponse.json({ error: "No submission given." }, { status: 400 });
  }

  const supabase = serverClient();

  // RLS applies here: this returns nothing if the viewer may not see it
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, student_id, transcript, duration_seconds, lessons(title, body, target_seconds)")
    .eq("id", submissionId)
    .single();

  if (!sub) {
    return NextResponse.json({ error: "That submission could not be found." }, { status: 404 });
  }

  if (sub.student_id !== profile.id && profile.role === "student") {
    return NextResponse.json({ error: "That is not your submission." }, { status: 403 });
  }

  if (!sub.transcript?.trim()) {
    return NextResponse.json({ error: "There is no transcript to work from." }, { status: 400 });
  }

  const { data: peer } = await supabase
    .from("feedback")
    .select("source, scores, strengths, improve")
    .eq("submission_id", submissionId)
    .in("source", ["peer", "teacher"]);

  if (!peer?.length) {
    return NextResponse.json(
      { error: "Partner feedback comes first — ask a classmate to score this one." },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("feedback")
    .select("id")
    .eq("submission_id", submissionId)
    .eq("source", "ai")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "This attempt already has AI feedback." }, { status: 409 });
  }

  const lesson = (sub as any).lessons;
  const target = lesson?.target_seconds ?? 120;
  const actual = sub.duration_seconds ?? 0;
  const diff = actual - target;
  const timing =
    Math.abs(diff) <= target * 0.15
      ? "within target"
      : diff > 0
      ? `over by ${diff} seconds`
      : `under by ${-diff} seconds`;

  const prompt = `You are an EAP tutor giving feedback on a B2-level undergraduate's recorded practice presentation in English.

ACTIVITY: ${lesson?.title ?? "practice task"}
TASK SET: ${(lesson?.body ?? "").slice(0, 1200)}
TARGET LENGTH: ${target} seconds. ACTUAL: ${actual} seconds (${timing}).

TRANSCRIPT (automatic speech-to-text, so expect transcription errors; judge the speaking, not the spelling):
"""${sub.transcript.slice(0, 8000)}"""

FEEDBACK ALREADY GIVEN BY A PARTNER OR TEACHER:
${JSON.stringify(peer)}

RUBRIC — score each criterion 1 to 4:
${RUBRIC.map(
  (c) => `${c.n}. ${c.name} [id: ${c.id}]\n  4 = ${c.l4}\n  3 = ${c.l3}\n  2 = ${c.l2}\n  1 = ${c.l1}`
).join("\n\n")}

Rules:
- Judge only what a transcript and timing can show: wording, structure, signposting, source acknowledgement, timing, pace, fillers, repetition. Never claim to judge eye contact, posture or gestures; where a criterion depends on those, score what is audible and say in the action what the partner should watch for.
- Quote or paraphrase a short specific moment from the transcript as evidence for every criterion.
- Build on the partner feedback where it agrees; say plainly where your reading differs.
- "action" is one concrete thing to do differently next time, one sentence, addressed to the student as "you".
- Be encouraging but honest. A 4 must be earned.

Reply with ONLY this JSON and nothing else:
{"scores":{"intro":1-4,"organization":1-4,"delivery":1-4,"language":1-4,"conclusion":1-4},
 "strengths":"what worked, quoting the transcript, 2-3 sentences",
 "improve":"the single most useful change, one sentence addressed to you"}`;

  let parsed: { scores: Record<string, number>; strengths: string; improve: string };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("anthropic error", res.status, detail.slice(0, 400));
      return NextResponse.json(
        { error: `The feedback service returned ${res.status}. Check the API key and its credit.` },
        { status: 502 }
      );
    }

    const body = await res.json();
    const text: string = body.content?.[0]?.text ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("no JSON in the reply");
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (e: any) {
    console.error("ai-feedback", e);
    return NextResponse.json(
      { error: "The reply could not be read as scores. Try again." },
      { status: 502 }
    );
  }

  // keep only valid rubric keys with values in range
  const scores: Record<string, number> = {};
  for (const c of RUBRIC) {
    const v = Math.round(Number(parsed.scores?.[c.id]));
    if (v >= 1 && v <= 4) scores[c.id] = v;
  }
  if (!Object.keys(scores).length) {
    return NextResponse.json({ error: "No usable scores came back." }, { status: 502 });
  }

  const admin = adminClient();
  const { error } = await admin.from("feedback").insert({
    submission_id: submissionId,
    author_id: null,
    source: "ai",
    scores,
    strengths: String(parsed.strengths ?? "").slice(0, 2000) || null,
    improve: String(parsed.improve ?? "").slice(0, 2000) || null,
  });

  if (error) {
    console.error("feedback insert", error);
    return NextResponse.json({ error: "The feedback could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
