import { useAuth } from "../context/AuthContext.jsx";
import { useEffect, useState } from "react";

function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flagged, setFlagged] = useState([]);
  const [fraudError, setFraudError] = useState(null);
  const [isFraudLoading, setIsFraudLoading] = useState(false);

  useEffect(() => {
    async function loadTransactions() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("http://localhost:3001/api/payments/history?limit=10", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to load transactions");
        }

        const result = await response.json();
        setTransactions(result.data?.transactions ?? []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTransactions();
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;

    async function loadFlagged() {
      setIsFraudLoading(true);
      setFraudError(null);
      try {
        const response = await fetch("http://localhost:3001/api/fraud/flagged?limit=5", {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to load flagged transactions");

        const result = await response.json();
        const alerts =
          result.data?.alerts ??
          result.data?.transactions ??
          result.data ??
          [];
        setFlagged(alerts);
      } catch (err) {
        setFraudError(err.message);
      } finally {
        setIsFraudLoading(false);
      }
    }

    loadFlagged();
  }, [user?.role]);

  const totalAmount = transactions.reduce(
    (sum, txn) => sum + Number(txn.amount || 0),
    0
  );
  const flaggedCount = transactions.filter(
    (txn) => txn.fraud?.riskLevel === "high"
  ).length;
  const authorizedCount = transactions.filter(
    (txn) => txn.status === "authorized"
  ).length;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-10 shadow-lg shadow-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-300">Dashboard</p>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Welcome back, {user?.firstName}!
              </h1>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-6 py-4 text-sm text-slate-200">
              <p className="font-semibold text-white">{user?.firstName} {user?.lastName}</p>
              <p className="text-slate-300">{user?.email}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.35em] text-indigo-300">{user?.role}</p>
            </div>
          </div>
          <p className="text-base text-slate-300">
            This area will soon show live payment metrics, fraud alerts, and admin shortcuts. We’ll add each card as we connect respective backend routes.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
  <article className="rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-5 shadow shadow-slate-900/50">
    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
      Total amount
    </p>
    <p className="mt-3 text-2xl font-semibold text-white">
      {transactions[0]?.currency ?? "USD"} {totalAmount.toFixed(2)}
    </p>
  </article>

  <article className="rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-5 shadow shadow-slate-900/50">
    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
      Authorized
    </p>
    <p className="mt-3 text-2xl font-semibold text-white">{authorizedCount}</p>
  </article>

  <article className="rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-5 shadow shadow-slate-900/50">
    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-300">
      Flagged
    </p>
    <p className="mt-3 text-2xl font-semibold text-rose-200">{flaggedCount}</p>
  </article>
</section>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 shadow-lg shadow-slate-900/70">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-semibold text-white">Recent transactions</h2>
    <p className="text-sm text-slate-400">
      Showing the latest {transactions.length} records
    </p>
  </div>

  {isLoading && (
    <p className="mt-6 text-sm text-slate-400">Loading transactions…</p>
  )}

  {error && (
    <p className="mt-6 text-sm text-rose-400">Error: {error}</p>
  )}

  {!isLoading && !error && transactions.length === 0 && (
    <p className="mt-6 text-sm text-slate-400">
      No transactions found yet. Run an authorization to see it here.
    </p>
  )}

  {!isLoading && !error && transactions.length > 0 && (
    <div className="mt-6 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="px-4 py-3 font-semibold">ID</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Amount</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {transactions.map((txn) => {
            const isFlagged = txn.fraud?.riskLevel === "high";

            return (
              <tr
                key={txn.id}
                className={isFlagged ? "bg-rose-950/40" : "bg-transparent"}
              >
                <td className="px-4 py-3 font-mono text-xs text-indigo-200">
                  {txn.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      isFlagged
                        ? "bg-rose-400/20 text-rose-300"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {txn.status}
                    {isFlagged && (
                      <span className="text-[0.65rem] uppercase tracking-[0.25em]">
                        flagged
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {txn.currency} {Number(txn.amount).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {txn.transactionType}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(txn.updatedAt).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )}
</div>

        <section className="grid gap-6 md:grid-cols-2">

          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow shadow-slate-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300">
              Fraud insights
            </p>

            {user?.role !== "admin" ? (
              <p className="mt-3 text-sm text-slate-400">
                Flagged transactions appear in the table above. Admins see global alerts here.
              </p>
            ) : (
              <>
                {isFraudLoading && (
                  <p className="mt-3 text-sm text-slate-400">Loading flagged alerts…</p>
                )}
                {fraudError && (
                  <p className="mt-3 text-sm text-rose-400">Error: {fraudError}</p>
                )}
                {!isFraudLoading && !fraudError && (
                  <ul className="mt-4 space-y-3">
                    {flagged.length === 0 ? (
                      <li className="text-sm text-slate-400">No flagged transactions right now.</li>
                    ) : (
                      flagged.map((alert) => {
                        const txnId =
                          alert.transactionId ??
                          alert.transaction_id ??
                          alert.id ??
                          "";
                        const riskScore = Number(
                          alert.riskScore ?? alert.risk_score ?? 0
                        );
                        const riskLevel = String(
                          alert.riskLevel ?? alert.risk_level ?? "unknown"
                        ).toLowerCase();
                        const rulesTriggered =
                          Array.isArray(alert.rulesTriggered)
                            ? alert.rulesTriggered
                            : Array.isArray(alert.rules_triggered)
                            ? alert.rules_triggered
                            : typeof alert.rulesTriggered === "string"
                            ? [alert.rulesTriggered]
                            : typeof alert.rules_triggered === "string"
                            ? [alert.rules_triggered]
                            : [];

                        const rulesLabel = rulesTriggered
                          .map((rule) =>
                            typeof rule === "string"
                              ? rule
                              : rule.rule ?? JSON.stringify(rule)
                          )
                          .join(", ");

                        const isHighRisk = riskLevel === "high";

                        return (
                          <li
                            key={txnId}
                            className={`rounded-xl border px-4 py-3 ${
                              isHighRisk
                                ? "border-rose-500/40 bg-rose-500/15"
                                : "border-amber-400/30 bg-amber-400/10"
                            }`}
                          >
                            <p className="text-sm font-semibold text-rose-200">
                              Transaction {txnId.slice(0, 8)}… · Risk{" "}
                              {riskScore.toFixed(0)}
                            </p>
                            <p className="text-xs text-rose-100/80">
                              Level: {riskLevel} · Rules:{" "}
                              {rulesLabel || "none"}
                            </p>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </>
            )}
          </article>
        </section>
      </div>
    </div>
    
  );
}

export default Dashboard;