import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api/payments";

function Payments() {
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [methods, setMethods] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [methodForm, setMethodForm] = useState({
    brand: "visa",
    lastFour: "",
    expiryMonth: "",
    expiryYear: "",
    cardholderName: "",
  });
  const [methodStatus, setMethodStatus] = useState({ type: null, message: "" });

  const [authForm, setAuthForm] = useState({
    amount: "100.00",
    currency: "USD",
    description: "",
    paymentMethodId: "",
  });
  const [authStatus, setAuthStatus] = useState({ type: null, message: "" });

  const [actionState, setActionState] = useState({ transactionId: null, action: null, error: null });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [methodsRes, historyRes] = await Promise.all([
          fetch(`${API_BASE}/methods`, { credentials: "include" }),
          fetch(`${API_BASE}/history`, { credentials: "include" }),
        ]);

        if (!methodsRes.ok && methodsRes.status !== 404) {
          throw new Error("Failed to load payment methods.");
        }
        if (!historyRes.ok && historyRes.status !== 404) {
          throw new Error("Failed to load payment history.");
        }

        const [methodsBody, historyBody] = await Promise.all([
          methodsRes.ok ? methodsRes.json() : {},
          historyRes.ok ? historyRes.json() : {},
        ]);

        const loadedMethods = methodsBody?.data?.paymentMethods ?? [];
        const loadedTransactions = historyBody?.data?.transactions ?? [];

        setMethods(loadedMethods);
        setTransactions(loadedTransactions);
        setAuthForm((previous) => ({
          ...previous,
          paymentMethodId: loadedMethods[0]?.id ?? "",
        }));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load payment data.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  const methodOptions = useMemo(
    () =>
      methods.map((method) => ({
        id: method.id,
        label: `${method.brand?.toUpperCase() ?? "CARD"} •••• ${method.lastFour} (${method.expiryMonth}/${method.expiryYear})`,
      })),
    [methods]
  );

  function updateMethodField(field, value) {
    setMethodForm((previous) => ({ ...previous, [field]: value }));
  }

  function updateAuthField(field, value) {
    setAuthForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleAddMethod(event) {
    event.preventDefault();
    setMethodStatus({ type: null, message: "" });

    const trimmedLastFour = methodForm.lastFour.trim();
    if (!/^\d{4}$/.test(trimmedLastFour)) {
      setMethodStatus({ type: "error", message: "Last four digits must be numeric." });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/methods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          brand: methodForm.brand,
          lastFour: trimmedLastFour,
          expiryMonth: methodForm.expiryMonth,
          expiryYear: methodForm.expiryYear,
          cardholderName: methodForm.cardholderName,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Failed to add payment method.");
      }

      const result = await response.json();
      const created = result.data?.paymentMethod;
      if (!created) throw new Error("Unexpected response from server.");

      setMethods((previous) => [created, ...previous]);
      setAuthForm((previous) => ({ ...previous, paymentMethodId: created.id }));
      setMethodStatus({ type: "success", message: "Payment method added." });
      setMethodForm({
        brand: "visa",
        lastFour: "",
        expiryMonth: "",
        expiryYear: "",
        cardholderName: "",
      });
    } catch (error) {
      setMethodStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to add payment method.",
      });
    }
  }

  async function handleAuthorize(event) {
    event.preventDefault();
    setAuthStatus({ type: null, message: "" });

    if (!authForm.paymentMethodId) {
      setAuthStatus({ type: "error", message: "Select a payment method." });
      return;
    }

    const amountNumber = Number(authForm.amount);
    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      setAuthStatus({ type: "error", message: "Enter a valid amount." });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: amountNumber,
          currency: authForm.currency,
          description: authForm.description || "Payment authorization",
          paymentMethodId: authForm.paymentMethodId,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Authorization failed.");
      }

      const result = await response.json();
      const newTransaction = result.data?.transaction;
      if (!newTransaction) throw new Error("Unexpected response from server.");

      setTransactions((previous) => [newTransaction, ...previous]);
      setAuthStatus({ type: "success", message: "Authorization created." });
      setAuthForm((previous) => ({
        ...previous,
        amount: "100.00",
        description: "",
      }));
    } catch (error) {
      setAuthStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Authorization failed.",
      });
    }
  }

  async function performTransactionAction(transaction, action) {
    setActionState({ transactionId: transaction.id, action, error: null });

    try {
      const response = await fetch(`${API_BASE}/${transaction.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: transaction.amount }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || `Failed to ${action} transaction.`);
      }

      const result = await response.json();
      const updated = result.data?.transaction;
      if (!updated) throw new Error("Unexpected response from server.");

      setTransactions((previous) =>
        previous.map((entry) =>
          entry.id === transaction.id ? { ...entry, ...updated } : entry
        )
      );
    } catch (error) {
      setActionState({
        transactionId: transaction.id,
        action: null,
        error: error instanceof Error ? error.message : `Failed to ${action}.`,
      });
      return;
    }

    setActionState({ transactionId: null, action: null, error: null });
  }

  function renderStatus(transaction) {
    const status = transaction.status ?? "unknown";
    const statusClass =
      status === "authorized"
        ? "bg-amber-500/20 text-amber-300"
        : status === "captured"
        ? "bg-emerald-500/20 text-emerald-300"
        : status === "refunded"
        ? "bg-slate-700 text-slate-200"
        : "bg-slate-800 text-slate-300";

    return (
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
            Payments
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Manage payment methods & transactions
          </h1>
          <p className="text-base text-slate-300">
            Signed in as <span className="font-semibold text-white">{user?.email}</span>
          </p>
          {loadError && <p className="text-sm text-rose-400">Error: {loadError}</p>}
        </header>

        <section className="grid gap-8 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow shadow-slate-950/50">
            <h2 className="text-lg font-semibold text-white">Add payment method</h2>
            <p className="mt-2 text-sm text-slate-300">
              Stored methods are simulated; they allow you to submit authorizations quickly.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleAddMethod}>
              <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Brand
                <select
                  value={methodForm.brand}
                  onChange={(event) => updateMethodField("brand", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">Amex</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Last four digits
                  <input
                    type="text"
                    value={methodForm.lastFour}
                    onChange={(event) => updateMethodField("lastFour", event.target.value)}
                    placeholder="4242"
                    maxLength={4}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Cardholder name
                  <input
                    type="text"
                    value={methodForm.cardholderName}
                    onChange={(event) => updateMethodField("cardholderName", event.target.value)}
                    placeholder="Jane Doe"
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Expiry month
                  <input
                    type="number"
                    value={methodForm.expiryMonth}
                    onChange={(event) => updateMethodField("expiryMonth", event.target.value)}
                    placeholder="MM"
                    min="1"
                    max="12"
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Expiry year
                  <input
                    type="number"
                    value={methodForm.expiryYear}
                    onChange={(event) => updateMethodField("expiryYear", event.target.value)}
                    placeholder="2027"
                    min="2024"
                    max="2035"
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                Save method
              </button>

              {methodStatus.type && (
                <p
                  className={`text-sm ${
                    methodStatus.type === "error" ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {methodStatus.message}
                </p>
              )}
            </form>

            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-300">
                Saved methods
              </h3>
              {methods.length === 0 ? (
                <p className="text-sm text-slate-400">No methods stored yet.</p>
              ) : (
                <ul className="space-y-3 text-sm text-slate-200">
                  {methods.map((method) => (
                    <li key={method.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <p className="font-semibold text-white">
                        {method.brand?.toUpperCase()} •••• {method.lastFour}
                      </p>
                      <p className="text-xs text-slate-400">
                        Expires {method.expiryMonth}/{method.expiryYear} · Token {method.token?.slice(0, 8)}…
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow shadow-slate-950/50">
            <h2 className="text-lg font-semibold text-white">Authorize a transaction</h2>
            <p className="mt-2 text-sm text-slate-300">
              Submit core details and PaySecure will evaluate fraud risk automatically.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleAuthorize}>
              <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Amount
                <input
                  type="number"
                  step="0.01"
                  value={authForm.amount}
                  onChange={(event) => updateAuthField("amount", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Currency
                  <select
                    value={authForm.currency}
                    onChange={(event) => updateAuthField("currency", event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Payment method
                  <select
                    value={authForm.paymentMethodId}
                    onChange={(event) => updateAuthField("paymentMethodId", event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 disabled:cursor-not-allowed"
                    disabled={methods.length === 0}
                  >
                    {methods.length === 0 && <option value="">Add a method first</option>}
                    {methodOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Description
                <textarea
                  value={authForm.description}
                  onChange={(event) => updateAuthField("description", event.target.value)}
                  rows={3}
                  placeholder="Order #42 · premium plan"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/50"
                disabled={methods.length === 0}
              >
                Submit authorization
              </button>

              {authStatus.type && (
                <p
                  className={`text-sm ${
                    authStatus.type === "error" ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {authStatus.message}
                </p>
              )}
            </form>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow shadow-slate-950/50">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent transactions</h2>
              <p className="text-sm text-slate-400">
                Includes fraud risk score when available.
              </p>
            </div>
            {isLoading && <p className="text-xs text-slate-500">Loading…</p>}
          </header>

          {transactions.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">No transactions recorded yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="px-4 py-3 font-semibold">Transaction</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 font-semibold">Risk</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {transactions.map((transaction) => {
                    const isActing = actionState.transactionId === transaction.id;
                    const fraud = transaction.fraud ?? transaction.fraudScore ?? null;

                    return (
                      <tr key={transaction.id} className="bg-transparent">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-indigo-200">
                            {transaction.id?.slice(0, 12)}…
                          </p>
                          <p className="text-xs text-slate-400">
                            {transaction.description ?? "No description"}
                          </p>
                        </td>
                        <td className="px-4 py-3">{renderStatus(transaction)}</td>
                        <td className="px-4 py-3 text-slate-200">
                          {transaction.currency}{" "}
                          {Number(transaction.amount ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {transaction.updatedAt
                            ? new Date(transaction.updatedAt).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {fraud ? (
                            <>
                              <p className="text-xs text-slate-200">
                                Score: {Number(fraud.riskScore ?? 0).toFixed(0)}
                              </p>
                              <p className="text-[0.7rem] uppercase tracking-[0.3em] text-indigo-300">
                                {String(fraud.riskLevel ?? "unknown")}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-slate-500">-</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2 text-xs">
                            <button
                              type="button"
                              disabled={
                                isActing ||
                                (transaction.status ?? "") !== "authorized"
                              }
                              onClick={() => performTransactionAction(transaction, "capture")}
                              className="rounded-lg border border-emerald-500 px-3 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                            >
                              {isActing && actionState.action === "capture"
                                ? "Capturing…"
                                : "Capture"}
                            </button>
                            <button
                              type="button"
                              disabled={
                                isActing ||
                                !["authorized", "captured"].includes(transaction.status ?? "")
                              }
                              onClick={() => performTransactionAction(transaction, "refund")}
                              className="rounded-lg border border-rose-500 px-3 py-2 font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                            >
                              {isActing && actionState.action === "refund"
                                ? "Processing…"
                                : "Refund"}
                            </button>
                            {actionState.transactionId === transaction.id && actionState.error && (
                              <p className="text-xs text-rose-400">{actionState.error}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Payments;