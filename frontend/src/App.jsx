import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";

const quickLinks = [
  { label: "Process payments", description: "Authorize, capture, and refund transactions.", href: "/payments" },
  { label: "Monitor fraud", description: "Review the scoring rules and recent alerts.", href: "/fraud/rules" },
  { label: "Admin controls", description: "Configure user roles and manage platform access.", href: "/admin/users" },
];

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const showLanding = location.pathname === "/";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-lg font-semibold text-white shadow shadow-indigo-500/60">
              PS
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-300">PaySecure Gateway</p>
              <p className="text-sm text-slate-300">Real-time payments control center</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden gap-6 text-sm font-medium text-slate-300 md:flex">
              <Link className={navClass(showLanding)} to="/">Home</Link>
              <Link className={navClass(location.pathname.startsWith("/payments"))} to="/payments">Payments</Link>
              <Link className={navClass(location.pathname.startsWith("/fraud"))} to="/fraud/rules">Fraud</Link>
              {isAuthenticated && user?.role === "admin" ? (
                <Link className={navClass(location.pathname.startsWith("/admin"))} to="/admin/users">Admin</Link>
              ) : (
                <span className="cursor-default text-slate-600">Admin</span>
              )}
              {isAuthenticated && (
                <Link className={navClass(location.pathname.startsWith("/dashboard"))} to="/dashboard">Dashboard</Link>
              )}
            </nav>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="text-right text-xs leading-tight text-slate-300">
                  <p className="font-semibold text-white">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="uppercase tracking-[0.35em] text-indigo-300">{user.role}</p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-300"
                >
                  Log out
                </button>
              </div>
            ) : (
              <Link
                to="/auth/login"
                className="rounded-full border border-indigo-500 px-4 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/10"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {showLanding ? <LandingContent /> : <Outlet />}
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} PaySecure Gateway. Educational demo.</p>
          <p className="text-slate-500">Tailwind utilities power every layout element on this console.</p>
        </div>
      </footer>
    </div>
  );
}

function LandingContent() {
  return (
    <div className="relative isolate overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-[-16rem] flex justify-center blur-3xl" aria-hidden>
        <div className="h-80 w-[48rem] bg-[radial-gradient(circle_at_top,_oklch(0.71_0.17_270)_0%,_transparent_70%)] opacity-70" />
      </div>
      <div className="pointer-events-none absolute -left-32 top-32 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" aria-hidden />

      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-18 lg:py-20">
        <section className="rounded-3xl border border-slate-800/70 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 p-10 shadow-2xl shadow-slate-950/60 ring-1 ring-indigo-500/20 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-12">
            <div className="max-w-xl space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
                Operator console
                <span className="h-1 w-1 rounded-full bg-indigo-300" />
                v1.0
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Shape every stage of a PaySecure transaction from one canvas
              </h1>
              <p className="text-lg leading-relaxed text-slate-300">
                Launch authorizations, inspect automated fraud scoring, and supervise admin actions with full auditability.
                This console mirrors the payment operations you roll out to merchants.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  to="/payments"
                  className="inline-flex items-center justify-center rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow shadow-indigo-500/40 transition hover:bg-indigo-400 hover:shadow-indigo-400/40"
                >
                  Start orchestrating payments
                </Link>
              
              </div>
            </div>

            <div className="w-full max-w-sm space-y-5">
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-inner shadow-indigo-500/20 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-300">
                  Live telemetry
                </p>
                <div className="mt-4 space-y-3">
                  <StatPill label="Fraud score latency" value="Sub-second" tone="emerald" />
                  <StatPill label="Auth → capture" value="< 250 ms" tone="sky" />
                  <StatPill label="Admin actions logged" value="100%" tone="violet" />
                </div>
              </div>

              <div className="grid gap-4 text-sm text-slate-200">
                <ToolkitItem
                  title="Authorize & score"
                  copy="Fire payment intents and inspect rule hits in real time."
                  accent="bg-indigo-500/30"
                  indicator="●"
                />
                <ToolkitItem
                  title="Capture & refund"
                  copy="Simulate settlement and reimbursement flows instantly."
                  accent="bg-sky-500/30"
                  indicator="▲"
                />
                <ToolkitItem
                  title="Audit-ready governance"
                  copy="Role changes cascade into the audit log automatically."
                  accent="bg-violet-500/25"
                  indicator="◆"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="group h-full overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/75 via-slate-900/40 to-slate-950/80 p-6 shadow shadow-slate-950/40 transition hover:border-indigo-500/60 hover:shadow-indigo-500/20"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300">
                {link.label}
              </p>
              <p className="mt-4 text-base text-slate-200">{link.description}</p>
              <span className="mt-6 inline-flex items-center text-sm font-semibold text-indigo-300 opacity-0 transition group-hover:opacity-100">
                Continue →
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone }) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "sky"
      ? "text-sky-300"
      : "text-violet-300";

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
      <span className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function ToolkitItem({ title, copy, accent, indicator }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 px-5 py-4 transition hover:border-indigo-500/40">
      <div className={`absolute -right-6 top-1/2 h-24 w-24 -translate-y-1/2 rotate-12 rounded-full ${accent} blur-3xl`} aria-hidden />
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
        <span className="text-xs text-indigo-300">{indicator}</span>
        {title}
      </p>
      <p className="mt-2 text-xs text-slate-400">{copy}</p>
    </div>
  );
}

function navClass(isActive) {
  return ["transition hover:text-white", isActive ? "text-white" : ""].filter(Boolean).join(" ");
}

export default App;