/**
 * A deliberately small Markdown renderer.
 *
 * Lesson bodies are written by teachers in the course editor, so they need
 * headings, bold, lists and paragraphs — and nothing else. A full Markdown
 * library would add a dependency and an HTML-injection surface for the sake
 * of features nobody is using.
 *
 * Everything is escaped before any formatting is applied, so a lesson body
 * can never inject markup.
 */

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string) {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export default function Prose({ text }: { text: string | null }) {
  if (!text) return null;

  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let list: string[] = [];
  let ordered = false;

  const flush = () => {
    if (!list.length) return;
    const items = list.map((item, i) => (
      <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
    ));
    blocks.push(
      ordered ? (
        <ol key={blocks.length} style={{ paddingLeft: 22, margin: "8px 0" }}>{items}</ol>
      ) : (
        <ul key={blocks.length} style={{ paddingLeft: 22, margin: "8px 0" }}>{items}</ul>
      )
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flush();
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const number = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const heading = line.match(/^(#{1,3})\s+(.*)$/);

    if (heading) {
      flush();
      const level = heading[1].length;
      blocks.push(
        <p
          key={blocks.length}
          style={{
            fontSize: level === 1 ? 19 : level === 2 ? 16 : 14.5,
            fontWeight: 700,
            color: "var(--ink)",
            margin: "16px 0 6px",
          }}
          dangerouslySetInnerHTML={{ __html: inline(heading[2]) }}
        />
      );
    } else if (bullet) {
      if (ordered) flush();
      ordered = false;
      list.push(bullet[1]);
    } else if (number) {
      if (!ordered) flush();
      ordered = true;
      list.push(number[2]);
    } else {
      flush();
      blocks.push(
        <p
          key={blocks.length}
          style={{ margin: "0 0 10px" }}
          dangerouslySetInnerHTML={{ __html: inline(line) }}
        />
      );
    }
  }
  flush();

  return <div className="lesson-body">{blocks}</div>;
}
