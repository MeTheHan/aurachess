"import { useEffect, useState } from \"react\";
import { api } from \"../lib/api\";
import { useAuth } from \"../context/AuthContext\";
import { Link } from \"react-router-dom\";

export const History = () => {
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(\"/users/me/history\").then(({ data }) => setGames(data)).finally(() => setLoading(false));
  }, []);

  const outcome = (g) => {
    if (g.result === \"draw\") return { label: \"DRAW\", color: \"text-zinc-400\" };
    const wonAsWhite = g.result === \"white_wins\" && g.white_user_id === user.user_id;
    const wonAsBlack = g.result === \"black_wins\" && g.black_user_id === user.user_id;
    if (wonAsWhite || wonAsBlack) return { label: \"WIN\", color: \"text-[#10B981]\" };
    return { label: \"LOSS\", color: \"text-[#EF4444]\" };
  };

  return (
    <div className=\"min-h-screen max-w-5xl mx-auto px-6 py-16\" data-testid=\"history-page\">
      <div className=\"label-eyebrow mb-3\">— Your record</div>
      <h1 className=\"font-display text-5xl lg:text-6xl font-black tracking-tighter mb-12\">Match History</h1>
      <div className=\"glass-card overflow-hidden\">
        <div className=\"grid grid-cols-[80px_1fr_120px_120px_120px] gap-4 px-6 py-4 border-b border-white/10 text-xs uppercase tracking-widest text-zinc-500 font-bold\">
          <div>Result</div><div>Opponent</div><div>Type</div><div>Moves</div><div className=\"text-right\">Date</div>
        </div>
        {loading ? <div className=\"p-8 text-center text-zinc-500\">Loading...</div> :
          games.length === 0 ? <div className=\"p-8 text-center text-zinc-500\">No finished games yet. <Link to=\"/dashboard\" className=\"text-[#D4AF37] hover:underline\">Play one</Link>.</div> :
          games.map((g, i) => {
            const o = outcome(g);
            const opponent = g.white_user_id === user.user_id ? g.black_username : g.white_username;
            return (
              <div key={g.game_id} className=\"grid grid-cols-[80px_1fr_120px_120px_120px] gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/[0.02]\" data-testid={`history-row-${i}`}>
                <div className={`font-bold font-mono-data ${o.color}`}>{o.label}</div>
                <div className=\"font-bold\">{opponent}</div>
                <div className=\"font-mono-data text-xs text-zinc-400 uppercase\">{g.type === \"ai\" ? `AI ${g.bot_elo}` : \"Online\"}</div>
                <div className=\"font-mono-data text-zinc-400\">{g.moves.length}</div>
                <div className=\"font-mono-data text-xs text-zinc-500 text-right\">{new Date(g.updated_at).toLocaleDateString()}</div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
};
"
