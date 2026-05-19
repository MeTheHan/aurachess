"import { useEffect, useRef } from \"react\";
import { useNavigate } from \"react-router-dom\";
import { api } from \"../lib/api\";
import { useAuth } from \"../context/AuthContext\";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export const AuthCallback = () => {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, \"\"));
    const sessionId = params.get(\"session_id\");
    if (!sessionId) {
      nav(\"/auth\");
      return;
    }
    (async () => {
      try {
        const { data } = await api.post(\"/auth/google-session\", { session_id: sessionId });
        setUser(data.user);
        // Clear hash
        window.history.replaceState({}, document.title, window.location.pathname);
        nav(\"/dashboard\");
      } catch (e) {
        nav(\"/auth\");
      }
    })();
  }, [nav, setUser]);

  return (
    <div className=\"min-h-screen flex items-center justify-center bg-[#0A0A0A]\">
      <div className=\"text-zinc-400 font-mono-data text-sm\">
        Authenticating<span className=\"loading-dot\">.</span><span className=\"loading-dot\">.</span><span className=\"loading-dot\">.</span>
      </div>
    </div>
  );
};
"
