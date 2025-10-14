import { useState,useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated) {
        navigate("/", { replace: true });
    }
    }, [isAuthenticated, navigate]);
  

  async function handleSubmit(event) {
    event.preventDefault();

    setStatus({ type: null, message: "" });
    setIsSubmitting(true);

    try {
      await login(email, password);
      setStatus({ type: "success", message: "Logged in successfully!" });
      navigate("/", { replace: true });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 px-10 py-12 shadow-lg shadow-slate-900/60"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-white">Sign in to PaySecure</h1>
          <p className="text-sm text-slate-300">
            Use your registered email and password to manage payments and fraud alerts.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block text-left text-sm font-medium text-slate-200">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-left text-sm font-medium text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              placeholder="••••••••"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/60"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>

        {status.type && (
          <p
            className={`text-sm ${
              status.type === "error" ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {status.message}
          </p>
        )}
      </form>
    </div>
  );
}

export default Login;