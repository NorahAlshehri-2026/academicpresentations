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
        </ol>
      </div>

      <div className="card">
        <h3>Recording a speaking task</h3>
        <ol className="guide">
          <li>Open <b>Activities</b> and tap the activity your teacher set. <b>Units</b> has the short reading for each unit.</li>
          <li>Run the preparation timer and plan a framework, not a script. Reading aloud costs marks under criterion 3.</li>
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
          <li>Your classmate finds it under <b>Shared with me</b>, listens, and scores it against the rubric.</li>
          <li>
            Their feedback appears on your attempt. Your teacher can hear and mark all your recordings without you
            sharing them.
          </li>
          <li>Once you have feedback, tap <b>Get AI feedback</b> for a second reading of your transcript.</li>
        </ol>
      </div>

      <div className="card">
        <h3>For teachers</h3>
        <ul className="small" style={{ paddingLeft: 18, margin: "8px 0 0" }}>
          <li style={{ marginBottom: 6 }}>
            <b>Units</b> and <b>Activities</b> show you exactly what students see (a student preview: you can try the recorder, nothing is saved). Open <b>My classes</b>, open a class, and post its link in your announcement or WhatsApp group. Close
            the link once everyone has joined, or make a new one to retire the old.
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>Open gradebook</b> shows who has joined, their attempts, and their marks. Open any attempt to listen,
            give feedback and enter the official mark.
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
    </>
  );
}
