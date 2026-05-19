"import { useEffect, useState } from \"react\";
import { api } from \"../lib/api\";
import { Trophy } from \"@phosphor-icons/react\";

export const Leaderboard = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(\"/leaderboard\").then(({ data }) => setPlayers(data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className=\"min-h-screen max-w-5xl mx-auto px-6 py-16\" data-testid=\"leaderboard-page\">
      <div className=\"label-eyebrow mb-3\">— Global Rankings</div>
      <h1 className=\"font-display text-5xl lg:text-6xl font-black tracking-tighter mb-12\">Leaderboard</h1>
      <div className=\"glass-card overflow-hidden\">
        <div className=\"grid grid-cols-[60px_1fr_120px_100px] gap-4 px-6 py-4 border-b border-white/10 text-xs uppercase tracking-widest text-zinc-500 font-bold\">
          <div>Rank</div><div>Player</div><div>Record</div><div className=\"text-right\">ELO</div>
        </div>
        {loading ? <div className=\"p-8 text-center text-zinc-500\">Loading...</div> :
          players.length === 0 ? <div className=\"p-8 text-center text-zinc-500\">No players yet.</div> :
          players.map((p, i) => (
            <div key={p.user_id} className=\"grid grid-cols-[60px_1fr_120px_100px] gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/[0.02]\" data-testid={`leaderboard-row-${i}`}>
              <div className=\"flex items-center gap-2 font-mono-data text-zinc-400\">
                {i < 3 && <Trophy size={16} className={i === 0 ? \"text-[#D4AF37]\" : i === 1 ? \"text-zinc-300\" : \"text-amber-700\"} weight=\"fill\" />}
                {i + 1}
              </div>
              <div className=\"font-bold\">{p.username}</div>
              <div className=\"font-mono-data text-sm text-zinc-400\">{p.wins}W / {p.losses}L / {p.draws}D</div>
              <div className=\"font-mono-data text-xl font-bold text-[#D4AF37] text-right\">{p.elo}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
};
"
