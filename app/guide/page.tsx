import { TermsText } from "@/app/_components/TermsText";
import { MAX_SETS, VIDEO_MAX_MB } from "@/app/_lib/staff-video-types";

export const metadata = { title: "Guide · Academic Presentations" };

export default function GuidePage() {
  return (
    <>
      <div className="card">
        <h3>Joining</h3>
        <ol className="guide">
          <li>
            Open the class link your teacher shared in the announcement or WhatsApp group. There is no public
            sign-up: the link is the only way in.
          </li>
          <li>Add your full name, your email address and a password. That creates your account and puts you in the class.</li>
          <li>
            Next time, just sign in. If you are given a second class link, open it while signed in and you are
            added to that class too.
          </li>
          <li>
            Your <b>Home</b> page shows your teacher&rsquo;s <b>announcements</b> at the top and a <b>calendar</b> of your
            deadlines at the bottom. Tap a day to see what is due; <b>Add all to my calendar</b> puts them in your phone&rsquo;s calendar.
          </li>
        </ol>
      </div>

      <div className="card">
        <h3>Recording a speaking task</h3>
        <ol className="guide">
          <li>Open <b>Activities</b> and tap the activity your teacher set. <b>Units</b> has the short reading for each unit.</li>
          <li>Run the preparation timer and plan a framework, not a script, and speak to your audience rather than reading aloud.</li>
          <li>
            Tap <b>Start recording</b>. After a three-second count-in the clock counts down your speaking time. It
            turns gold in the last 15 seconds, red when you go over, and stops on its own 45 seconds after the target.
          </li>
          <li>
            Check the transcript box. It fills in by itself in Chrome; elsewhere, type roughly what you said,
            because the AI reads only this.
          </li>
          <li>
            Tap <b>Save</b>. You have <b>two attempts</b> per task. Attempt 1 can be deleted later; attempt 2 is
            final and cannot be deleted. Recording again before you save does not use up an attempt.
          </li>
        </ol>
      </div>

      <div className="card">
        <h3>Sharing and feedback</h3>
        <ol className="guide">
          <li>Under your saved attempt (or from <b>My recordings</b>), tap <b>Share</b> next to a classmate&rsquo;s name. That is all.</li>
          <li>Your classmate finds it under <b>Shared with me</b>, listens, and checks it against the lesson objectives with written comments. Only the final presentation in the last unit is scored on the full rubric.</li>
          <li>
            Their feedback appears on your attempt. Your teacher can hear and mark all your recordings without you
            sharing them.
          </li>
          <li>Once you have feedback, tap <b>Write the feedback request</b>. Copy it into any free AI assistant (Claude, ChatGPT or Gemini), then paste its whole answer back and tap <b>Save</b>. It is free, and it is practice feedback, not your mark.</li>
        </ol>
      </div>

      <div className="card">
        <h3>For teachers</h3>
        <ul className="small" style={{ paddingLeft: 18, margin: "8px 0 0" }}>
          <li style={{ marginBottom: 6 }}>
            <b>Student preview</b> in the header shows you the whole site as a student sees it: the student tabs, the
            student Home page with sample details, and none of the teacher-only parts. You can try the recorder; nothing is
            saved unless you are enrolled in a class yourself. Press <b>Exit preview</b> (or open My classes) to go back.
          </li>
          <li style={{ marginBottom: 6 }}>
            Open <b>My classes</b>, open a class, and post its link in your announcement or WhatsApp group. Close
            the link once everyone has joined, or make a new one to retire the old.
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>Announcements</b> are on your Home page: press <b>New announcement</b>, write a title and message, tick the
            classes it is for and choose how long it shows. Students see it at the top of their Home page. Administrators can
            also post to everyone in the academy. Whoever posted it, and any administrator, can edit or remove it.
          </li>
          <li style={{ marginBottom: 6 }}>
            The <b>calendar</b> on your Home page shows the deadlines of your classes (administrators: every class). Tap a day
            to see what is due and open the class. Deadlines are set in each class, under Deadlines.
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>Open gradebook</b> shows who has joined, their attempts, and their marks. Open any attempt to listen,
            give feedback and enter the official mark.
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>Recorded lectures</b> keeps up to {MAX_SETS} recorded lectures for each course you teach, each with up to three
            videos. Upload a file of up to {VIDEO_MAX_MB} MB, or paste a YouTube (Unlisted), Google Drive, Vimeo or OneDrive link
            for a longer video. Students never see this tab; press <b>Show to class</b> to play a lecture full screen on the
            classroom screen. Add a lecture&rsquo;s sources in its <b>References</b> box (one per line, APA style); they are
            listed in alphabetical order at the bottom of the lecture.
          </li>
          <li>Teacher and administrator accounts are created only from a one-time link sent by the academy owner.</li>
        </ul>
      </div>

      <div className="card">
        <h3>If something does not work</h3>
        <ul className="small" style={{ paddingLeft: 18, margin: "8px 0 0" }}>
          <li style={{ marginBottom: 6 }}><b>No microphone prompt:</b> allow the microphone in your browser&rsquo;s site settings and reload.</li>
          <li style={{ marginBottom: 6 }}><b>Transcript stays empty:</b> speech-to-text runs in Chrome. Elsewhere, type what you said.</li>
          <li><b>The link says it does not work:</b> your teacher may have made a new one. Ask for the current link.</li>
        </ul>
      </div>

      <div className="card" id="terms" style={{ scrollMarginTop: 90 }}>
        <h3>Terms of use</h3>
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          Students accept these when they create their account, and cannot open the course until they have.
        </p>
        <TermsText />
      </div>
    </>
  );
}
