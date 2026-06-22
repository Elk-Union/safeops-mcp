"use client";

import React, { useState, useEffect } from "react";

export default function RollbacksPage() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch("http://localhost:8000/api/v1/rollbacks/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load configuration rollback snapshots");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setSnapshots(data);
      }
    } catch (err: any) {
      setError(err.message || "Could not retrieve rollback checkpoints");
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("safeops_token");
    window.location.reload();
  };

  const handleRestore = async (id: string) => {
    setError(null);
    setRestoringId(id);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/rollbacks/${id}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to trigger checkpoint restoration");
      }

      // Refresh list
      fetchSnapshots();
    } catch (err: any) {
      setError(err.message || "Error restoring snapshot");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-800">State Snapshot Rollback Center</h2>
        <p className="text-slate-500 text-xs mt-1">Review pre-execution checkpoints, monitor automated recoveries, and trigger manual restorations.</p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Snapshots Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-mono text-[10px] tracking-wider font-bold text-slate-400 uppercase">Configuration Snapshot Checkpoints</h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading backup checkpoints...</div>
        ) : snapshots.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No configuration snapshot checkpoints recorded in the system.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-xs font-mono">
                <th className="py-3.5 px-6">Timestamp</th>
                <th className="py-3.5 px-6">Snapshot ID</th>
                <th className="py-3.5 px-6">Snapshot Type</th>
                <th className="py-3.5 px-6">Target Path/Resource</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {snapshots.map((snap) => (
                <tr key={snap.id} className="hover:bg-slate-50/40 transition">
                  <td className="py-4 px-6 font-mono text-slate-400 text-[10px]">
                    {new Date(snap.created_at).toLocaleString()}
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-500 text-[10px]">{snap.id}</td>
                  <td className="py-4 px-6 font-mono text-[10px] uppercase text-slate-600">
                    {snap.snapshot_type.replace("_", " ")}
                  </td>
                  <td className="py-4 px-6 font-mono text-[10px] text-indigo-600 font-bold">{snap.snapshot_target}</td>
                  <td className="py-4 px-6 font-bold font-mono">
                    <span className={snap.is_rolled_back ? "text-emerald-600" : "text-indigo-600"}>
                      {snap.is_rolled_back ? "RESTORED" : "AVAILABLE"}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleRestore(snap.id)}
                      disabled={snap.is_rolled_back || restoringId !== null}
                      className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {restoringId === snap.id ? "Restoring..." : snap.is_rolled_back ? "Restored" : "Restore Checkpoint"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
