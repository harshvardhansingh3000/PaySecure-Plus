import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [updating, setUpdating] = useState({
    userId: null,
    action: null,
    error: null,
  });

  const isAdmin = useMemo(() => user?.role === "admin", [user?.role]);

  useEffect(() => {
    if (!isAdmin) return;

    async function loadUsers() {
      setIsLoading(true);
      setFetchError(null);

      try {
        const response = await fetch("http://localhost:3001/api/admin/users", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to load users.");
        }

        const result = await response.json();
        const normalized =
          result.data?.users?.map((record) => ({
            id: record.id,
            email: record.email,
            firstName: record.firstName,
            lastName: record.lastName,
            role: record.role,
            isActive: record.isActive,
            createdAt: record.createdAt,
          })) ?? [];
        setUsers(normalized);
      } catch (error) {
        setFetchError(
          error instanceof Error ? error.message : "Failed to load users."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadUsers();
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleRoleChange(userId, nextRole) {
    setUpdating({ userId, action: "role", error: null });

    try {
      const response = await fetch(
        `http://localhost:3001/api/admin/users/${userId}/role`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: nextRole }),
        }
      );

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Role update failed.");
      }

      const result = await response.json();
      const updated = result.data?.user;
      if (!updated) {
        throw new Error("Unexpected response body.");
      }

      setUsers((prev) =>
        prev.map((entry) => (entry.id === userId ? { ...entry, role: updated.role } : entry))
      );
    } catch (error) {
      setUpdating({
        userId,
        action: "role",
        error: error instanceof Error ? error.message : "Role update failed.",
      });
    } finally {
      setUpdating((prev) =>
        prev.userId === userId && prev.action === "role" ? { userId: null, action: null, error: null } : prev
      );
    }
  }

  async function handleStatusToggle(userId) {
    setUpdating({ userId, action: "status", error: null });

    try {
      const response = await fetch(
        `http://localhost:3001/api/admin/users/${userId}/status`,
        { method: "PUT", credentials: "include" }
      );

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Status update failed.");
      }

      const result = await response.json();
      const updated = result.data?.user;
      if (!updated) throw new Error("Unexpected response body.");

      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === userId ? { ...entry, isActive: updated.isActive } : entry
        )
      );
    } catch (error) {
      setUpdating({
        userId,
        action: "status",
        error: error instanceof Error ? error.message : "Status update failed.",
      });
    } finally {
      setUpdating((prev) =>
        prev.userId === userId && prev.action === "status"
          ? { userId: null, action: null, error: null }
          : prev
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-300">
            Admin
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            User management
          </h1>
          <p className="text-base text-slate-300">
            Review platform accounts, adjust roles, and suspend or reactivate users as needed.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 shadow-lg shadow-slate-900/70">
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading users…</p>
          ) : fetchError ? (
            <p className="text-sm text-rose-400">Error: {fetchError}</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-400">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map((entry) => {
                    const isUpdating = updating.userId === entry.id;
                    return (
                      <tr key={entry.id} className="bg-transparent">
                        <td className="px-4 py-3 text-slate-200">
                          <span className="font-semibold text-white">
                            {entry.firstName} {entry.lastName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{entry.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={entry.role}
                            disabled={isUpdating && updating.action === "role"}
                            onChange={(event) => handleRoleChange(entry.id, event.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:cursor-not-allowed"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              entry.isActive
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {entry.isActive ? "active" : "suspended"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 space-y-2">
                          <button
                            type="button"
                            disabled={isUpdating && updating.action === "status"}
                            onClick={() => handleStatusToggle(entry.id)}
                            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-indigo-200 disabled:cursor-not-allowed"
                          >
                            {entry.isActive ? "Suspend" : "Activate"}
                          </button>
                          {isUpdating && updating.error && (
                            <p className="text-xs text-rose-400">{updating.error}</p>
                          )}
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

export default AdminUsers;