"import { useState } from \"react\";
import { useNavigate } from \"react-router-dom\";
import { useAuth } from \"../context/AuthContext\";
import { api } from \"../lib/api\";
import { Slider } from \"../components/ui/slider\";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from \"../components/ui/dialog\";
import { Robot, Users, Link as LinkIcon, ArrowRight, Copy, Check } from \"@phosphor-icons/react\";
import { toast } from \"sonner\";

const LOBBY_BG = \"https://static.prod-images.emergentagent.com/jobs/250d6593-1f4c-493a-a17f-c49170f81aae/images/f08d5292d5c247d465e8b370bf220aabe2524e4d4494593cdf40e86bb89bd098.png\";

export const Dashboard = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [botElo, setBotElo] = useState(800);
  const [color, setColor] = useState(\"white\");
  const [creating, setCreating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [friendOpen, setFriendOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [shareLink, setShareLink] = useState(\"\");
  const [joinCode, setJoinCode] = useState(\"\");
  const [copied, setCopied] = useState(false);

  const startAi = async () => {
    setCreating(true);
    try {
      const { data } = await api.post(\"/games/ai\", { bot_elo: botElo, player_color: color });
      nav(`/play/${data.game_id}`);
    } catch (e) {
      toast.error(\"Failed to start game\");
    } finally { setCreating(false); }
  };

  const createOnline = async () => {
    setCreating(true);
    try {
      const { data } = await api.post(\"/games/online\", { player_color: color });
      const link = `${window.location.origin}/play/${data.game_id}`;
      setShareLink(link);
    } catch (e) {
      toast.error(\"Failed to create game\");
    } finally { setCreating(false); }
  };

  const goJoin = () => {
    if (!joinCode.trim()) return;
    const code = joinCode.trim().split(\"/\").pop();
    nav(`/play/${code}`);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className=\"min-h-screen relative\" data-testid=\"dashboard-page\">
      <div className=\"absolute inset-0 z-0 opacity-30\">
        <img src={LOBBY_BG} alt=\"\" className=\"w-full h-full object-cover blur-2xl scale-110\" />
        <div className=\"absolute inset-0 bg-[#0A0A0A]/80\" />
      </div>

      <div className=\"relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-16\">
        <div className=\"mb-16 fade-in-up\">
          <div className=\"label-eyebrow mb-3\">— Dashboard</div>
          <h1 className=\"font-display text-5xl lg:text-7xl font-black tracking-tighter mb-4\">
            Hello, <span className=\"text-[#D4AF37]\">{user?.username}</span>.
          </h1>
          <div className=\"flex flex-wrap gap-8 mt-8 font-mono-data text-sm\">
            <div><div className=\"text-zinc-500 text-xs uppercase tracking-widest\">ELO</div><div className=\"text-2xl font-bold text-[#D4AF37]\" data-testid=\"dash-elo\">{user?.elo}</div></div>
            <div><div className=\"text-zinc-500 text-xs uppercase tracking-widest\">Games</div><div className=\"text-2xl font-bold\">{user?.games_played}</div></div>
            <div><div className=\"text-zinc-500 text-xs uppercase tracking-widest\">W / L / D</div><div className=\"text-2xl font-bold\">{user?.wins} / {user?.losses} / {user?.draws}</div></div>
          </div>
        </div>

        <div className=\"grid grid-cols-1 md:grid-cols-3 gap-6\">
          {/* AI BOT */}
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <button className=\"glass-card p-8 rounded-2xl text-left group hover:bg-white/[0.07] transition-all\" data-testid=\"dash-play-ai-card\">
                <Robot size={40} className=\"text-[#D4AF37] mb-6\" weight=\"duotone\" />
                <div className=\"label-eyebrow mb-2\">— Solo</div>
                <h3 className=\"font-display text-3xl font-bold mb-2\">Play vs AI</h3>
                <p className=\"text-zinc-400 text-sm mb-6\">Stockfish, calibrated 400 – 3000.</p>
                <div className=\"text-[#D4AF37] text-sm font-bold flex items-center gap-2\">Configure <ArrowRight size={16} weight=\"bold\" /></div>
              </button>
            </DialogTrigger>
            <DialogContent className=\"bg-[#121212] border border-white/10 rounded-none text-white max-w-md\">
              <DialogHeader><DialogTitle className=\"font-display text-2xl\">Configure AI Match</DialogTitle></DialogHeader>
              <div className=\"space-y-6 py-4\">
                <div>
                  <div className=\"flex items-center justify-between mb-3\">
                    <label className=\"label-eyebrow\">Bot ELO</label>
                    <span className=\"font-mono-data text-2xl font-bold text-[#D4AF37]\" data-testid=\"ai-elo-value\">{botElo}</span>
                  </div>
                  <Slider min={400} max={3000} step={50} value={[botElo]} onValueChange={(v) => setBotElo(v[0])} className=\"elo-slider\" data-testid=\"ai-elo-slider\" />
                  <div className=\"flex justify-between text-xs text-zinc-500 font-mono-data mt-2\"><span>400</span><span>3000</span></div>
                </div>
                <div>
                  <label className=\"label-eyebrow block mb-3\">Your Color</label>
                  <div className=\"grid grid-cols-2 gap-2\">
                    <button onClick={() => setColor(\"white\")} className={`py-3 border ${color === \"white\" ? \"border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]\" : \"border-white/10 text-zinc-400\"}`} data-testid=\"ai-color-white\">White</button>
                    <button onClick={() => setColor(\"black\")} className={`py-3 border ${color === \"black\" ? \"border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]\" : \"border-white/10 text-zinc-400\"}`} data-testid=\"ai-color-black\">Black</button>
                  </div>
                </div>
              </div>
              <DialogFooter><button onClick={startAi} disabled={creating} className=\"btn-gold px-8 py-3 w-full\" data-testid=\"ai-start-btn\">{creating ? \"Starting...\" : \"Start Match\"}</button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* PRIVATE FRIEND */}
          <Dialog open={friendOpen} onOpenChange={(o) => { setFriendOpen(o); if (!o) setShareLink(\"\"); }}>
            <DialogTrigger asChild>
              <button className=\"glass-card p-8 rounded-2xl text-left group hover:bg-white/[0.07] transition-all\" data-testid=\"dash-play-friend-card\">
                <Users size={40} className=\"text-[#D4AF37] mb-6\" weight=\"duotone\" />
                <div className=\"label-eyebrow mb-2\">— Friends</div>
                <h3 className=\"font-display text-3xl font-bold mb-2\">Private Game</h3>
                <p className=\"text-zinc-400 text-sm mb-6\">Create a share link. Play live.</p>
                <div className=\"text-[#D4AF37] text-sm font-bold flex items-center gap-2\">Generate <ArrowRight size={16} weight=\"bold\" /></div>
              </button>
            </DialogTrigger>
            <DialogContent className=\"bg-[#121212] border border-white/10 rounded-none text-white max-w-md\">
              <DialogHeader><DialogTitle className=\"font-display text-2xl\">Create Private Game</DialogTitle></DialogHeader>
              {!shareLink ? (
                <div className=\"space-y-6 py-4\">
                  <div>
                    <label className=\"label-eyebrow block mb-3\">Your Color</label>
                    <div className=\"grid grid-cols-2 gap-2\">
                      <button onClick={() => setColor(\"white\")} className={`py-3 border ${color === \"white\" ? \"border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]\" : \"border-white/10 text-zinc-400\"}`} data-testid=\"online-color-white\">White</button>
                      <button onClick={() => setColor(\"black\")} className={`py-3 border ${color === \"black\" ? \"border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]\" : \"border-white/10 text-zinc-400\"}`} data-testid=\"online-color-black\">Black</button>
                    </div>
                  </div>
                  <button onClick={createOnline} disabled={creating} className=\"btn-gold w-full py-3\" data-testid=\"online-create-btn\">{creating ? \"Creating...\" : \"Generate Link\"}</button>
                </div>
              ) : (
                <div className=\"space-y-4 py-4\">
                  <p className=\"text-sm text-zinc-400\">Send this link to your friend. Then go to the game.</p>
                  <div className=\"flex items-center bg-[#0A0A0A] border border-white/10\">
                    <input readOnly value={shareLink} className=\"flex-1 bg-transparent px-3 py-3 text-xs font-mono-data outline-none\" data-testid=\"online-share-link\" />
                    <button onClick={copyLink} className=\"px-3 text-[#D4AF37] hover:bg-white/5 h-full py-3\" data-testid=\"online-copy-btn\">
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                  <button onClick={() => nav(shareLink.replace(window.location.origin, \"\"))} className=\"btn-gold w-full py-3\" data-testid=\"online-goto-game\">Go to Game</button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* JOIN GAME */}
          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger asChild>
              <button className=\"glass-card p-8 rounded-2xl text-left group hover:bg-white/[0.07] transition-all\" data-testid=\"dash-join-card\">
                <LinkIcon size={40} className=\"text-[#D4AF37] mb-6\" weight=\"duotone\" />
                <div className=\"label-eyebrow mb-2\">— Join</div>
                <h3 className=\"font-display text-3xl font-bold mb-2\">Join Game</h3>
                <p className=\"text-zinc-400 text-sm mb-6\">Have a link? Paste it here.</p>
                <div className=\"text-[#D4AF37] text-sm font-bold flex items-center gap-2\">Open <ArrowRight size={16} weight=\"bold\" /></div>
              </button>
            </DialogTrigger>
            <DialogContent className=\"bg-[#121212] border border-white/10 rounded-none text-white max-w-md\">
              <DialogHeader><DialogTitle className=\"font-display text-2xl\">Join a Game</DialogTitle></DialogHeader>
              <div className=\"space-y-4 py-4\">
                <label className=\"label-eyebrow block\">Paste link or game code</label>
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder=\"game_xxxxxxx or full URL\" className=\"w-full bg-[#0A0A0A] border border-white/10 px-4 py-3 outline-none focus:border-[#D4AF37]\" data-testid=\"join-code-input\" />
                <button onClick={goJoin} className=\"btn-gold w-full py-3\" data-testid=\"join-go-btn\">Join</button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};
"
