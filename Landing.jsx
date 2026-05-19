"import { Link } from \"react-router-dom\";
import { useAuth } from \"../context/AuthContext\";
import { ArrowRight, Robot, Users, Trophy } from \"@phosphor-icons/react\";

const HERO = \"https://static.prod-images.emergentagent.com/jobs/250d6593-1f4c-493a-a17f-c49170f81aae/images/00b7621629265f287a8d6f31ed4c1486a481272ea037296c840ffba2552815e1.png\";

export const Landing = () => {
  const { user } = useAuth();

  return (
    <div className=\"min-h-screen bg-[#0A0A0A] text-white\" data-testid=\"landing-page\">
      <section className=\"relative min-h-[100vh] flex items-center overflow-hidden\">
        <div className=\"absolute inset-0 z-0\">
          <img src={HERO} alt=\"\" className=\"w-full h-full object-cover\" />
          <div className=\"absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20\" />
          <div className=\"absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40\" />
        </div>
        <div className=\"relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-24 w-full\">
          <div className=\"max-w-3xl fade-in-up\">
            <div className=\"label-eyebrow mb-6\" data-testid=\"hero-eyebrow\">— Online Chess. Reimagined.</div>
            <h1 className=\"font-display text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.95] mb-8\">
              Play chess.<br/>
              Climb the <span className=\"text-[#D4AF37]\">ranks.</span>
            </h1>
            <p className=\"text-lg lg:text-xl text-zinc-300 max-w-xl mb-12 leading-relaxed\">
              Face Stockfish at any strength from 400 to 3000 ELO, or challenge friends with a private link. Every player begins at 800.
            </p>
            <div className=\"flex flex-wrap gap-4\">
              <Link to={user ? \"/dashboard\" : \"/auth\"} className=\"btn-gold px-8 py-4 text-base inline-flex items-center gap-3\" data-testid=\"hero-cta-play\">
                Start Playing <ArrowRight size={20} weight=\"bold\" />
              </Link>
              {!user && (
                <Link to=\"/auth\" className=\"btn-ghost-border px-8 py-4 text-base\" data-testid=\"hero-cta-signup\">
                  Create Account
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className=\"max-w-7xl mx-auto px-6 lg:px-12 py-24\">
        <div className=\"label-eyebrow mb-4\">— Three ways to play</div>
        <h2 className=\"font-display text-4xl lg:text-5xl font-black tracking-tighter mb-16 max-w-2xl\">
          Pick your battle.
        </h2>
        <div className=\"grid grid-cols-1 md:grid-cols-3 gap-6\">
          {[
            { icon: Robot, title: \"Bot Match\", desc: \"Calibrated Stockfish from 400 to 3000 ELO. Train against beginners or grandmasters.\" },
            { icon: Users, title: \"Private Game\", desc: \"Generate a one-time link. Share with a friend. Play instantly, no waiting room.\" },
            { icon: Trophy, title: \"Climb the Ladder\", desc: \"Win rated games to gain ELO. Every game shifts your standing on the global leaderboard.\" },
          ].map((f, i) => (
            <div key={i} className=\"glass-card p-8 rounded-2xl\" data-testid={`landing-feature-${i}`}>
              <f.icon size={36} className=\"text-[#D4AF37] mb-6\" weight=\"duotone\" />
              <h3 className=\"font-display text-2xl font-bold mb-3\">{f.title}</h3>
              <p className=\"text-zinc-400 text-sm leading-relaxed\">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className=\"border-t border-white/5 py-12 text-center text-xs text-zinc-500 font-mono-data\">
        AURA CHESS / Powered by Stockfish
      </footer>
    </div>
  );
};
"
