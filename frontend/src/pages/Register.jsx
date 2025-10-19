import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function Register() {
  const { register, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "user",
  });
  const [status, setStatus] = useState({ type: null, message: "" });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ type: null, message: "" });

    if (form.password !== form.confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      setStatus({ type: "success", message: "Account created. Redirecting…" });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Registration failed.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-6 rounded-3xl border border-slate-800 bg-slate-900/80 px-10 py-12 shadow-lg shadow-slate-900/70"
      >
        <h1 className="text-3xl font-semibold text-white text-center">
          Create your account
        </h1>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-200">
            First name
            <input
              type="text"
              value={form.firstName}
              onChange={(event) => updateField("firstName", event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </label>
          <label className="text-sm font-medium text-slate-200">
            Last name
            <input
              type="text"
              value={form.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-200">
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-200">
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </label>
          <label className="text-sm font-medium text-slate-200">
            Confirm password
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/60"
        >
          {isLoading ? "Creating account…" : "Create account"}
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

        <p className="text-sm text-slate-400 text-center">
          Already registered?{" "}
          <Link className="font-semibold text-indigo-300 hover:text-indigo-200" to="/auth/login">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;