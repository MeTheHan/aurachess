"import { useEffect, useMemo, useRef, useState } from \"react\";
import { Chess } from \"chess.js\";
import { Chessboard } from \"react-chessboard\";
import { useNavigate } from \"react-router-dom\";
import { api } from \"../lib/api\";
import { useAuth } from \"../context/AuthContext\";
import { Flag, Copy, Check, ArrowsClockwise } from \"@phosphor-icons/react\";
import { toast } from \"sonner\";

const BOARD_LIGHT = \"#D4D4D8\";
const BOARD_DARK = \"#1C1F26\";

export const ChessGame = ({ gameId }) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [game, setGame] = useState(null);
  const [chess, setChess] = useState(new Chess());
  const [thinking, setThinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  const loadGame = async () => {
    try {
      const { data } = await api.get(`/games/${gameId}`);
      setGame(data);
      const c = new Chess(); c.load(data.fen); setChess(c);
      return data;
    } catch (e) {
      toast.error(\"Game not found\");
      nav(\"/dashboard\");
    }
  };

  useEffect(() => { loadGame(); /* eslint-disable-next-line */ }, [gameId]);

  // Polling for online games / waiting state
  useEffect(() => {
    if (!game) return;
    const shouldPoll = game.type === \"online\" && (game.status === \"waiting\" || (game.status === \"active\" && !isMyTurn(game)));
    if (shouldPoll) {
      pollRef.current = setInterval(loadGame, 2000);
      return () => clearInterval(pollRef.current);
    }
    return () => pollRef.current && clearInterval(pollRef.current);
    // eslint-disable-next-line
  }, [game?.status, game?.fen, game?.white_user_id, game?.black_user_id]);

  const myColor = useMemo(() => {
    if (!game || !user) return null;
    if (game.white_user_id === user.user_id) return \"white\";
    if (game.black_user_id === user.user_id) return \"black\";
    return null;
  }, [game, user]);

  function isMyTurn(g) {
    if (!g || !user) return false;
    const c = new Chess(); c.load(g.fen);
    const turn = c.turn() === \"w\" ? \"white\" : \"black\";
    const mine = g.white_user_id === user.user_id ? \"white\" : (g.black_user_id === user.user_id ? \"black\" : null);
    return mine === turn;
  }

  const joinAsBlack = async () => {
    try {
      await api.post(`/games/${gameId}/join`, {});
      await loadGame();
    } catch (e) {
      toast.error(e.response?.data?.detail || \"Cannot join\");
    }
  };

  // Auto-join if open slot and not participant
  useEffect(() => {
    if (!game || !user) return;
    if (game.type === \"online\" && game.status === \"waiting\") {
      if (!myColor && (game.white_user_id === null || game.black_user_id === null)) {
        joinAsBlack();
      }
    }
    // eslint-disable-next-line
  }, [game?.status, user?.user_id]);

  const onDrop = (from, to, piece) => {
    if (!game || game.status !== \"active\") return false;
    if (!myColor) return false;
    const turn = chess.turn() === \"w\" ? \"white\" : \"black\";
    if (turn !== myColor) return false;

    // Try move locally first to validate
    const move = { from, to, promotion: \"q\" };
    const test = new Chess(); test.load(chess.fen());
    const result = test.move(move);
    if (!result) return false;

    // Optimistically update
    setChess(test);
    setThinking(true);
    api.post(`/games/${gameId}/move`, { from_sq: from, to_sq: to, promotion: result.promotion || null })
      .then(({ data }) => {
        setGame(data);
        const c = new Chess(); c.load(data.fen); setChess(c);
      })
      .catch((e) => {
        toast.error(e.response?.data?.detail || \"Move rejected\");
        loadGame();
      })
      .finally(() => setThinking(false));
    return true;
  };

  const resign = async () => {
    try {
      const { data } = await api.post(`/games/${gameId}/resign`);
      setGame(data);
    } catch (e) { toast.error(\"Failed\"); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!game) {
    return <div className=\"min-h-screen flex items-center justify-center text-zinc-400 font-mono-data\">Loading game...</div>;
  }

  const orientation = myColor === \"black\" ? \"black\" : \"white\";
  const turn = chess.turn() === \"w\" ? \"white\" : \"black\";
  const movesPairs = [];
  for (let i = 0; i < game.moves.length; i += 2) {
    movesPairs.push([game.moves[i], game.moves[i + 1]]);
  }

  return (
    <div className=\"min-h-screen px-4 lg:px-12 py-8\" data-testid=\"chess-game-page\">
      <div className=\"max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6\">
        {/* Board */}
        <div className=\"lg:col-span-8\">
          {/* Opponent banner */}
          <PlayerBar
            name={(myColor === \"white\" ? game.black_username : game.white_username) || \"Waiting...\"}
            elo={(myColor === \"white\" ? game.black_elo : game.white_elo) || \"—\"}
            color={myColor === \"white\" ? \"black\" : \"white\"}
            isTurn={game.status === \"active\" && ((myColor === \"white\" && turn === \"black\") || (myColor === \"black\" && turn === \"white\"))}
            isBot={game.type === \"ai\" && ((myColor === \"white\" && !game.black_user_id) || (myColor === \"black\" && !game.white_user_id))}
          />

          <div className=\"aura-board my-4\">
            <Chessboard
              options={{
                position: chess.fen(),
                onPieceDrop: ({ sourceSquare, targetSquare, piece }) => onDrop(sourceSquare, targetSquare, piece),
                boardOrientation: orientation,
                darkSquareStyle: { backgroundColor: BOARD_DARK },
                lightSquareStyle: { backgroundColor: BOARD_LIGHT },
                allowDragging: game.status === \"active\" && !!myColor && turn === myColor,
                animationDurationInMs: 200,
                id: \"aura-board\",
              }}
            />
          </div>

          <PlayerBar
            name={(myColor === \"white\" ? game.white_username : game.black_username) || user?.username}
            elo={(myColor === \"white\" ? game.white_elo : game.black_elo) || user?.elo}
            color={myColor || \"white\"}
            isTurn={game.status === \"active\" && myColor === turn}
            isMe
          />
        </div>

        {/* Sidebar */}
        <div className=\"lg:col-span-4 flex flex-col gap-4\">
          <div className=\"glass-card p-6\">
            <div className=\"label-eyebrow mb-3\">— Status</div>
            <GameStatus game={game} myColor={myColor} turn={turn} thinking={thinking} />
          </div>

          {game.type === \"online\" && game.status === \"waiting\" && (
            <div className=\"glass-card p-6\" data-testid=\"waiting-panel\">
              <div className=\"label-eyebrow mb-3\">— Share link</div>
              <div className=\"flex items-center bg-black/40 border border-white/10\">
                <input readOnly value={window.location.href} className=\"flex-1 bg-transparent px-3 py-2 text-xs font-mono-data outline-none\" />
                <button onClick={copyLink} className=\"px-3 py-2 text-[#D4AF37] hover:bg-white/5\">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
              </div>
            </div>
          )}

          <div className=\"glass-card p-6 flex-1 min-h-[300px]\">
            <div className=\"label-eyebrow mb-3\">— Moves</div>
            <div className=\"max-h-[400px] overflow-y-auto font-mono-data text-sm\" data-testid=\"move-history\">
              {movesPairs.length === 0 && <div className=\"text-zinc-500\">No moves yet.</div>}
              {movesPairs.map(([w, b], i) => (
                <div key={i} className=\"grid grid-cols-[40px_1fr_1fr] gap-2 py-1 border-b border-white/5\">
                  <span className=\"text-zinc-500\">{i + 1}.</span>
                  <span>{w}</span>
                  <span>{b || \"\"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className=\"flex gap-3\">
            {game.status === \"active\" && myColor && (
              <button onClick={resign} className=\"flex-1 btn-ghost-border py-3 flex items-center justify-center gap-2 hover:border-red-500 hover:text-red-400\" data-testid=\"resign-btn\">
                <Flag size={16} /> Resign
              </button>
            )}
            {game.status === \"finished\" && (
              <button onClick={() => nav(\"/dashboard\")} className=\"flex-1 btn-gold py-3 flex items-center justify-center gap-2\" data-testid=\"back-dashboard-btn\">
                <ArrowsClockwise size={16} /> New Game
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PlayerBar = ({ name, elo, color, isTurn, isMe, isBot }) => (
  <div className={`flex items-center justify-between p-4 ${isTurn ? \"border-l-2 border-[#D4AF37]\" : \"border-l-2 border-transparent\"} bg-white/[0.03]`} data-testid={isMe ? \"player-bar-me\" : \"player-bar-opponent\"}>
    <div className=\"flex items-center gap-3\">
      <div className={`w-3 h-3 ${color === \"white\" ? \"bg-white\" : \"bg-zinc-700 border border-white/30\"}`} />
      <div>
        <div className=\"font-bold\">{name} {isBot && <span className=\"text-xs text-[#D4AF37]\">(AI)</span>}</div>
        <div className=\"text-xs font-mono-data text-zinc-500\">ELO {elo}</div>
      </div>
    </div>
    {isTurn && <div className=\"text-xs font-mono-data text-[#D4AF37] uppercase tracking-widest\">Thinking</div>}
  </div>
);

const GameStatus = ({ game, myColor, turn, thinking }) => {
  if (game.status === \"waiting\") {
    return <div data-testid=\"status-text\"><div className=\"font-display text-2xl font-bold mb-1\">Waiting for opponent</div><div className=\"text-zinc-400 text-sm\">Share the link to start.</div></div>;
  }
  if (game.status === \"finished\") {
    let txt = \"\";
    if (game.result === \"draw\") txt = \"Draw\";
    else if (myColor && ((game.result === \"white_wins\" && myColor === \"white\") || (game.result === \"black_wins\" && myColor === \"black\"))) txt = \"You won\";
    else if (myColor) txt = \"You lost\";
    else txt = game.result === \"white_wins\" ? \"White wins\" : \"Black wins\";
    return <div data-testid=\"status-text\"><div className=\"font-display text-3xl font-bold text-[#D4AF37] mb-1\">{txt}</div><div className=\"text-zinc-400 text-sm\">Game over.</div></div>;
  }
  return (
    <div data-testid=\"status-text\">
      <div className=\"font-display text-2xl font-bold mb-1\">{turn === myColor ? \"Your move\" : \"Opponent's move\"}</div>
      <div className=\"text-zinc-400 text-sm\">{thinking ? \"Calculating...\" : `${turn === \"white\" ? \"White\" : \"Black\"} to play`}</div>
    </div>
  );
};
"
