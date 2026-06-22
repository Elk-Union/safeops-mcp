"use client";

import React, { useState } from "react";

// Mock snapshots mapping execution failures to configuration tarballs
const INITIAL_SNAPSHOTS = [
  { id: "snap_101", time: "19:52:05", type: "directory_backup", target: "~/.config/nvim", file: "neovim_backup_20260622195200.tar.gz", status: "AVAILABLE" },
  { id: "snap_102", time: "19:41:20", type: "directory_backup", target: "~/.config/nvim", file: "neovim_backup_20260622194110.tar.gz", status: "RESTORED" },
  { id: "snap_103", time: "18:22:15", type: "directory_backup", target: "~/.emacs.d", file: "emacs_backup_20260622182200.tar.gz", status: "AVAILABLE" }
];

export default function RollbacksPage() {
  const [snapshots, setSnapshots] = useState(INITIAL_SNAPSHOTS);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = (id: string) => {
    setRestoringId(id);
    setTimeout(() => {
      setSnapshots(
        snapshots.map((s) => (s.id === id ? { ...s, status: "RESTORED" } : s))
      );
      setRestoringId(null);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">State Snapshot Rollback Center</h2>
        <p className="text-zinc-400 text-sm mt-1">Review pre-execution checkpoints, monitor automated recoveries, and trigger manual restorations.</p>
      </div>

      {/* Snapshots Table */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-cyber-border">
          <h3 className="font-mono text-sm font-semibold text-white">// CONFIGURATION SNAPSHOT CHECKPOINTS</h3>
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-cyber-border bg-[#18181b]/30 text-zinc-400 text-xs font-mono">
              <th className="py-3.5 px-6">Timestamp</th>
              <th className="py-3.5 px-6">Snapshot ID</th>
              <th className="py-3.5 px-6">Snapshot Type</th>
              <th className="py-3.5 px-6">Target Path</th>
              <th className="py-3.5 px-6">Backup Archive</th>
              <th className="py-3.5 px-6">Status</th>
              <th className="py-3.5 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-cyber-border">
            {snapshots.map((snap) => (
              <tr key={snap.id} className="hover:bg-[#18181b]/10 transition">
                <td className="py-4 px-6 font-mono text-zinc-500 text-xs">{snap.time}</td>
                <td className="py-4 px-6 font-mono text-zinc-200 text-xs">{snap.id}</td>
                <td className="py-4 px-6 font-mono text-xs uppercase text-zinc-400">{snap.type.replace("_", " ")}</td>
                <td className="py-4 px-6 font-mono text-xs text-cyber-cyan font-bold">{snap.target}</td>
                <td className="py-4 px-6 font-mono text-xs text-zinc-400">{snap.file}</td>
                <td className="py-4 px-6 font-bold text-xs font-mono">
                  <span className={snap.status === "AVAILABLE" ? "text-cyber-cyan" : "text-cyber-emerald"}>
                    {snap.status}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => handleRestore(snap.id)}
                    disabled={snap.status === "RESTORED" || restoringId !== null}
                    className={`px-3 py-1 bg-cyber-emerald/10 text-cyber-emerald hover:bg-cyber-emerald/20 border border-cyber-emerald/30 rounded text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {restoringId === snap.id ? "Restoring..." : snap.status === "RESTORED" ? "Restored" : "Restore"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
