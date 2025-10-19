import { useMemo } from "react";

const API_DOCS_URL = (() => {
  const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
  return `${base.replace(/\/$/, "")}/api-docs/`;
})();

function ApiDocs() {
  const docsUrl = useMemo(() => API_DOCS_URL, []);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
            REST reference
          </p>
          <h1 className="text-4xl font-semibold text-white">Gateway API Explorer</h1>
          <p className="text-sm text-slate-300">
            Embedded <code className="font-mono text-indigo-200">{docsUrl}</code> viewer served by the backend.
          </p>
        </header>

        <div className="min-h-[70vh] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow shadow-slate-900/60">
          <iframe
            title="PaySecure API documentation"
            src={docsUrl}
            className="h-full w-full min-h-[70vh] border-0"
          />
        </div>
      </div>
    </div>
  );
}

export default ApiDocs;