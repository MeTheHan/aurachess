"import { useState } from \"react\";
import { useNavigate } from \"react-router-dom\";
import { api, setToken } from \"../lib/api\";
import { useAuth } from \"../context/AuthContext\";
import { Crown, GoogleLogo } from \"@phosphor-icons/react\";
import { toast } from \"sonner\";

export const AuthPage = () => {
  const [mode, setMode] = useState(\"login\"); // login | signup
  const [username, setUsername] = useState(\"\");
  const [password, setPassword] = useState(\"\");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === \"signup\" ? \"/auth/signup\" : \"/auth/login\";
      const { data } = await api.post(endpoint, { username, password });
      setToken(data.token);
      setUser(data.user);
      toast.success(mode === \"signup\" ? \"Welcome aboard.\" : \"Welcome back.\");
      nav(\"/dashboard\");
    } catch (err) {
      toast.error(err.response?.data?.detail || \"Authentication failed\");
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + \"/dashboard\";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className=\"min-h-screen flex items-center justify-center px-6 bg-[#0A0A0A]\" data-testid=\"auth-page\">
      <div className=\"w-full max-w-md\">
        <div className=\"text-center mb-10\">
          <div className=\"inline-flex items-center justify-center w-14 h-14 bg-[#D4AF37] mb-6\">
            <Crown size={28} weight=\"fill\" color=\"#000\" />
          </div>
          <h1 className=\"font-display text-4xl font-black tracking-tighter mb-2\">
            {mode === \"login\" ? \"Welcome back\" : \"Join AURA\"}
          </h1>
          <p className=\"text-zinc-400 text-sm\">
            {mode === \"login\" ? \"Sign in to continue your climb.\" : \"New players start at ELO 800.\"}
          </p>
        </div>

        <button onClick={googleLogin} className=\"w-full btn-ghost-border py-3 mb-4 flex items-center justify-center gap-3\" data-testid=\"auth-google-btn\">
          <GoogleLogo size={20} weight=\"bold\" /> Continue with Google
        </button>

        <div className=\"flex items-center gap-4 my-6\">
          <div className=\"flex-1 h-px bg-white/10\" />
          <span className=\"text-xs text-zinc-500 font-mono-data\">OR</span>
          <div className=\"flex-1 h-px bg-white/10\" />
        </div>

        <form onSubmit={submit} className=\"space-y-4\">
          <div>
            <label className=\"label-eyebrow block mb-2\">Username</label>
            <input
              type=\"text\"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              className=\"w-full bg-[#0A0A0A] border border-white/10 px-4 py-3 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/30 outline-none text-white\"
              placeholder=\"grandmaster_42\"
              data-testid=\"auth-username-input\"
            />
          </div>
          <div>
            <label className=\"label-eyebrow block mb-2\">Password</label>
            <input
              type=\"password\"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              className=\"w-full bg-[#0A0A0A] border border-white/10 px-4 py-3 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/30 outline-none text-white\"
              placeholder=\"••••••••\"
              data-testid=\"auth-password-input\"
            />
          </div>
          <button type=\"submit\" disabled={loading} className=\"w-full btn-gold py-3 disabled:opacity-50\" data-testid=\"auth-submit-btn\">
            {loading ? \"...\" : mode === \"login\" ? \"Sign In\" : \"Create Account\"}
          </button>
        </form>

        <div className=\"text-center mt-6 text-sm text-zinc-400\">
          {mode === \"login\" ? \"New here?\" : \"Have an account?\"}{\" \"}
          <button onClick={() => setMode(mode === \"login\" ? \"signup\" : \"login\")} className=\"text-[#D4AF37] hover:underline font-bold\" data-testid=\"auth-toggle-mode\">
            {mode === \"login\" ? \"Create one\" : \"Sign in\"}
          </button>
        </div>
      </div>
    </div>
  );
};
"
