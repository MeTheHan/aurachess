"import \"@/App.css\";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from \"react-router-dom\";
import { AuthProvider, useAuth } from \"./context/AuthContext\";
import { Toaster } from \"sonner\";
import { Navbar } from \"./components/Navbar\";
import { Landing } from \"./pages/Landing\";
import { AuthPage } from \"./pages/Auth\";
import { Dashboard } from \"./pages/Dashboard\";
import { PlayGame } from \"./pages/PlayGame\";
import { Leaderboard } from \"./pages/Leaderboard\";
import { History } from \"./pages/History\";
import { AuthCallback } from \"./components/AuthCallback\";

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className=\"min-h-screen flex items-center justify-center text-zinc-500 font-mono-data\">Loading...</div>;
  if (!user) return <Navigate to=\"/auth\" replace />;
  return children;
};

const AppRouter = () => {
  const location = useLocation();
  // Handle Emergent OAuth callback (hash-based)
  if (location.hash?.includes(\"session_id=\")) {
    return <AuthCallback />;
  }
  return (
    <>
      <Navbar />
      <Routes>
        <Route path=\"/\" element={<Landing />} />
        <Route path=\"/auth\" element={<AuthPage />} />
        <Route path=\"/dashboard\" element={<Protected><Dashboard /></Protected>} />
        <Route path=\"/play/:gameId\" element={<Protected><PlayGame /></Protected>} />
        <Route path=\"/leaderboard\" element={<Protected><Leaderboard /></Protected>} />
        <Route path=\"/history\" element={<Protected><History /></Protected>} />
        <Route path=\"*\" element={<Navigate to=\"/\" replace />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <div className=\"App\">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster theme=\"dark\" position=\"top-right\" toastOptions={{ style: { background: \"#121212\", border: \"1px solid rgba(255,255,255,0.1)\", color: \"#fff\" } }} />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
"
