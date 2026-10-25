import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES } from "../_games";

export default function Game({ params }: { params: { game: string } }) {
  const game = GAMES.find((g) => g.slug === params.game);
  if (!game) notFound();
  return (
    <>
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3>{game.title}</h3>
          <p className="small muted">Advanced Reading and Writing</p>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link className="small" href="/reading-writing">All activities</Link>
          <a className="small" href={`/games/${game.slug}.html`} target="_blank" rel="noopener">Open full screen</a>
        </div>
      </div>
      <iframe
        src={`/games/${game.slug}.html`}
        title={game.title}
        style={{ width: "100%", height: "85vh", border: 0, borderRadius: 12, display: "block" }}
      />
    </>
  );
}
