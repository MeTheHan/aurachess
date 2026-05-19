"import { Link, useNavigate } from \"react-router-dom\";
import { useAuth } from \"../context/AuthContext\";
import { Crown, SignOut, Trophy, ClockCounterClockwise } from \"@phosphor-icons/react\";

export const Navbar = () => {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <nav className=\"border-b border-white/5 backdrop-blur-xl bg-black/40 sticky top-0 z-40\" data-testid=\"navbar\">
      <div className=\"max-w-7xl mx-auto px-6 py-4 flex items-center justify-between\">
        <Link to={user ? \"/dashboard\" : \"/\"} className=\"flex items-center gap-3 group\" data-testid=\"navbar-logo\">
          <div className=\"w-9 h-9 bg-[#D4AF37] flex items-center justify-center\">
            <Crown size={22} weight=\"fill\" color=\"#000\" />
          </div>
          <span className=\"font-display font-black text-xl tracking-tighter\">AURA CHESS</span>
        </Link>
        <div className=\"flex items-center gap-6\">
          {user ? (
            <>
              <Link to=\"/leaderboard\" className=\"text-sm text-zinc-300 hover:text-white flex items-center gap-2\" data-testid=\"navbar-leaderboard\">
                <Trophy size={18} /> Leaderboard
              </Link>
              <Link to=\"/history\" className=\"text-sm text-zinc-300 hover:text-white flex items-center gap-2\" data-testid=\"navbar-history\">
                <ClockCounterClockwise size={18} /> History
              </Link>
              <div className=\"flex items-center gap-3 pl-4 border-l border-white/10\">
                <div className=\"text-right\">
                  <div className=\"text-sm font-bold\" data-testid=\"navbar-username\">{user.username}</div>
                  <div className=\"text-xs font-mono-data text-[#D4AF37]\" data-testid=\"navbar-elo\">ELO {user.elo}</div>
                </div>
                <button onClick={async () => { await logout(); nav(\"/\"); }} className=\"text-zinc-400 hover:text-white\" data-testid=\"navbar-logout\">
                  <SignOut size={20} />
                </button>
              </div>
            </>
          ) : (
            <Link to=\"/auth\" className=\"btn-gold px-5 py-2 text-sm\" data-testid=\"navbar-signin\">Sign In</Link>
          )}
        </div>
      </div>
    </nav>
  );
};
"
