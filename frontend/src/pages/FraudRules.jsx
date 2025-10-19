import { useEffect, useMemo, useState } from "react";

const RULE_GROUPS = [
	{
		title: "Velocity checks",
		rules: [
			{
				id: "VELOCITY_SAME_CARD",
				weight: 25,
				detail: "More than 5 authorized/captured transactions with the same payment method in 10 minutes.",
			},
			{
				id: "VELOCITY_SAME_USER",
				weight: 20,
				detail: "More than 10 authorized/captured transactions by the same user in 30 minutes.",
			},
		],
	},
	{
		title: "Amount checks",
		rules: [
			{
				id: "HIGH_AMOUNT",
				weight: 15,
				detail: "Transaction amount ≥ $5,000.",
			},
			{
				id: "UNUSUAL_AMOUNT",
				weight: 10,
				detail: "Transaction amount ≥ $10,000.",
			},
		],
	},
	{
		title: "Time-based checks",
		rules: [
			{
				id: "NIGHT_TRANSACTION",
				weight: 5,
				detail: "Transactions between 10 PM and 6 AM local time.",
			},
			{
				id: "WEEKEND_TRANSACTION",
				weight: 3,
				detail: "Transactions on Saturday or Sunday.",
			},
		],
	},
	{
		title: "Card maturity checks",
		rules: [
			{
				id: "NEW_CARD",
				weight: 10,
				detail: "Card added within the last 24 hours.",
			},
			{
				id: "EXPIRING_CARD",
				weight: 5,
				detail: "Card expires within 30 days.",
			},
		],
	},
	{
		title: "Geographic checks",
		rules: [
			{
				id: "GEO_MISMATCH",
				weight: 20,
				detail: "Simulated IP vs BIN mismatch (approx. 1 in 7 IPs trigger).",
			},
		],
	},
];

const RISK_THRESHOLDS = [
	{ label: "Low", max: 30, color: "text-emerald-300" },
	{ label: "Medium", max: 60, color: "text-amber-300" },
	{ label: "High", max: 80, color: "text-rose-300" },
	{ label: "Critical", max: 90, color: "text-rose-200" },
];

function FraudRules() {
	const [stats, setStats] = useState(null);
	const [statsError, setStatsError] = useState(null);
	const [isLoadingStats, setIsLoadingStats] = useState(true);

	useEffect(() => {
		async function loadStats() {
			setIsLoadingStats(true);
			setStatsError(null);
			try {
				const response = await fetch("http://localhost:3001/api/fraud/statistics?timeRange=24h", {
					credentials: "include",
				});
				if (!response.ok) throw new Error("Failed to load fraud statistics.");
				const data = await response.json();
				setStats(data.data?.statistics ?? null);
			} catch (err) {
				setStatsError(err instanceof Error ? err.message : "Failed to load fraud statistics.");
			} finally {
				setIsLoadingStats(false);
			}
		}
		loadStats();
	}, []);

	const totalTriggered = useMemo(
		() =>
			RULE_GROUPS.reduce(
				(count, group) => count + group.rules.reduce((inner, rule) => inner + (rule.weight > 0 ? 1 : 0), 0),
				0
			),
		[]
	);

	return (
		<div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
			<div className="mx-auto max-w-6xl space-y-12">
				<header className="space-y-4">
					<p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">Fraud engine</p>
					<div className="space-y-2">
						<h1 className="text-4xl font-semibold text-white">Rule catalog & risk thresholds</h1>
						<p className="text-base text-slate-300">
							Each authorization is scored by the rule engine in{" "}
							<code className="font-mono text-indigo-200">fraudDetection.js</code>. The cards below summarise active
							rules, risk thresholds, and 24 h statistics (if available).
						</p>
					</div>
				</header>

				<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{RISK_THRESHOLDS.map((threshold, index) => (
						<article
							key={threshold.label}
							className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-5 shadow shadow-slate-950/40"
						>
							<p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300">
								{threshold.label} risk
							</p>
							<p className={`mt-3 text-2xl font-semibold ${threshold.color}`}>≤ {threshold.max}</p>
							<p className="mt-2 text-xs text-slate-400">
								Rule scores at or below this value classify the transaction as{" "}
								{threshold.label.toLowerCase()} risk.
							</p>
							{index === RISK_THRESHOLDS.length - 1 && (
								<p className="mt-2 text-[0.7rem] text-slate-500">
									Scores above {threshold.max} are capped at 100.
								</p>
							)}
						</article>
					))}
					<article className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-5 shadow shadow-slate-950/40">
						<p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300">Active rules</p>
						<p className="mt-3 text-2xl font-semibold text-white">{totalTriggered}</p>
						<p className="mt-2 text-xs text-slate-400">
							Weighted heuristic rules contribute to the composite score per authorization attempt.
						</p>
					</article>
				</section>

				<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow shadow-slate-950/50">
					<header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
						<div>
							<h2 className="text-xl font-semibold text-white">24 hour fraud statistics</h2>
							<p className="text-sm text-slate-400">
								Source:{" "}
								<code className="font-mono text-indigo-200">GET /api/fraud/statistics?timeRange=24h</code>
							</p>
						</div>
						{isLoadingStats && <p className="text-xs text-slate-500">Loading…</p>}
					</header>

					{statsError && <p className="mt-4 text-sm text-rose-400">Error: {statsError}</p>}

					{!isLoadingStats && !statsError && stats && (
						<div className="mt-6 grid gap-4 md:grid-cols-4">
							<article className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4">
								<p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Total analyzed</p>
								<p className="mt-2 text-2xl font-semibold text-white">{stats.totalTransactions}</p>
							</article>
							<article className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4">
								<p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Average score</p>
								<p className="mt-2 text-2xl font-semibold text-white">
									{stats.averageRiskScore.toFixed(1)}
								</p>
							</article>
							<article className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4">
								<p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Max risk</p>
								<p className="mt-2 text-2xl font-semibold text-white">{stats.maxRiskScore}</p>
							</article>
							<article className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4">
								<p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Distribution</p>
								<p className="mt-2 text-sm text-slate-300">
									Low {stats.riskDistribution.low} · Medium {stats.riskDistribution.medium} · High{" "}
									{stats.riskDistribution.high} · Critical {stats.riskDistribution.critical}
								</p>
							</article>
						</div>
					)}

					{!isLoadingStats && !statsError && !stats && (
						<p className="mt-4 text-sm text-slate-400">No fraud analyses captured in the last 24 hours.</p>
					)}
				</section>

				<section className="space-y-6">
					{RULE_GROUPS.map((group) => (
						<article
							key={group.title}
							className="rounded-3xl border border-slate-800 bg-slate-900/60 px-7 py-6 shadow shadow-slate-950/40"
						>
							<header className="flex items-start justify-between gap-4">
								<div>
									<h3 className="text-lg font-semibold text-white">{group.title}</h3>
									<p className="text-xs text-slate-400">
										Derived from{" "}
										<code className="font-mono text-indigo-200">backend/src/services/fraudDetection.js</code>
									</p>
								</div>
							</header>

							<ul className="mt-4 space-y-4">
								{group.rules.map((rule) => (
									<li key={rule.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4">
										<p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
											{rule.id}
										</p>
										<p className="mt-3 text-sm text-slate-200">{rule.detail}</p>
										<p className="mt-2 text-xs text-slate-400">Weight: +{rule.weight} risk points</p>
									</li>
								))}
							</ul>
						</article>
					))}
				</section>
			</div>
		</div>
	);
}

export default FraudRules;