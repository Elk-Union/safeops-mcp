"use client";

import React, { useState, useEffect } from "react";
import TerminalConsole from "./components/TerminalConsole";

export default function OverviewPage() {
  const [executions, setExecutions] = useState<any[]>([]);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [stats, setStats] = useState({
    clientsCount: 0,
    pendingApprovalsCount: 0,
    toolsCount: 0,
    verificationStatus: "Checking...",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    // Poll stats and executions list every 3 seconds to keep dashboard fresh
    const interval = setInterval(fetchDashboardData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      // Fetch Clients
      const clientsRes = await fetch("http://localhost:8000/api/v1/clients/", { headers });
      if (clientsRes.status === 401) {
        handleUnauthorized();
        return;
      }
      const clientsData = await clientsRes.json().catch(() => []);

      // Fetch Pending Approvals
      const approvalsRes = await fetch("http://localhost:8000/api/v1/approvals/?status_filter=PENDING", { headers });
      const approvalsData = await approvalsRes.json().catch(() => []);

      // Fetch Tools Catalog
      const toolsRes = await fetch("http://localhost:8000/api/v1/tools/", { headers });
      const toolsData = await toolsRes.json().catch(() => []);

      // Verify Ledger
      const verifyRes = await fetch("http://localhost:8000/api/v1/audit/verify", { method: "POST", headers });
      const verifyData = await verifyRes.json().catch(() => ({ status: "unknown" }));

      // Fetch executions list (contains live states like EXECUTING)
      const executionsRes = await fetch("http://localhost:8000/api/v1/executions/", { headers });
      const executionsData = await executionsRes.json().catch(() => []);

      setStats({
        clientsCount: Array.isArray(clientsData) ? clientsData.length : 0,
        pendingApprovalsCount: Array.isArray(approvalsData) ? approvalsData.length : 0,
        toolsCount: Array.isArray(toolsData) ? toolsData.length : 0,
        verificationStatus: verifyData.status === "verified" ? "INTEGRITY INTACT" : "UNVERIFIED",
      });

      if (Array.isArray(executionsData)) {
        setExecutions(executionsData);
      }
    } catch (err: any) {
      setError("Failed to sync dashboard metrics with FastAPI backend");
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("safeops_token");
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-800">System Overview</h2>
          <p className="text-slate-500 text-xs mt-0.5">Real-time status monitoring, threat prevention, and dry-run execution catalog.</p>
        </div>
      </div>

      {/* Simple Dismissible Welcome Banner */}
      {showWelcome && (
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex items-start justify-between">
          <div className="text-xs text-indigo-900 leading-relaxed max-w-4xl">
            <span className="font-bold">Welcome to SafeOps MCP Control Panel.</span> Dry-runs are isolated inside secure sandbox overlays. High-risk operations pause automatically and require administrator approval. Click the <span className="font-semibold">Console</span> button on any execution log to monitor the live terminal output.
          </div>
          <button 
            onClick={() => setShowWelcome(false)}
            className="text-indigo-400 hover:text-indigo-600 text-xs font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between h-24 shadow-sm">
          <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400">Connected Agents</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-extrabold text-slate-800">{stats.clientsCount}</span>
            <span className="text-slate-400 text-xs font-semibold">active</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between h-24 shadow-sm">
          <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400">Blocked Actions</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-2xl font-extrabold ${stats.pendingApprovalsCount > 0 ? "text-amber-600 animate-pulse" : "text-slate-800"}`}>
              {stats.pendingApprovalsCount}
            </span>
            <span className="text-slate-400 text-xs font-semibold">reviews pending</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between h-24 shadow-sm">
          <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400">Governed Tools</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-extrabold text-slate-800">{stats.toolsCount}</span>
            <span className="text-slate-400 text-xs font-semibold">registered</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between h-24 shadow-sm">
          <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400">Ledger Verification</span>
          <div className="mt-2">
            <span className={`text-[10px] font-bold font-mono tracking-wider px-2 py-0.5 rounded ${
              stats.verificationStatus === "INTEGRITY INTACT" 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                : "bg-rose-50 text-rose-700 border border-rose-100 animate-pulse"
            }`}>
              {stats.verificationStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Executions Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-mono text-[10px] tracking-wider font-bold text-slate-400 uppercase">
            Recent Sandbox Executions
          </h3>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            Refresh
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {error ? (
            <div className="p-6 text-center text-rose-600 text-xs">{error}</div>
          ) : executions.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">No execution logs registered in the database.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-[10px] font-mono">
                  <th className="py-2.5 px-5">Time</th>
                  <th className="py-2.5 px-5">Tool</th>
                  <th className="py-2.5 px-5">Arguments</th>
                  <th className="py-2.5 px-5 text-center">Risk</th>
                  <th className="py-2.5 px-5 text-center">Status</th>
                  <th className="py-2.5 px-5 text-right">Console</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {executions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-slate-50/20 transition">
                    <td className="py-3 px-5 font-mono text-slate-400 text-[10px]">
                      {new Date(exec.created_at + "Z").toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-5 font-bold text-slate-700">
                      <code className="text-indigo-600 font-bold bg-indigo-50/50 border border-indigo-100/30 px-1.5 py-0.5 rounded font-mono text-[11px]">
                        {exec.tool_name}
                      </code>
                    </td>
                    <td className="py-3 px-5 font-mono text-slate-500 max-w-[200px] truncate">
                      {JSON.stringify(exec.arguments)}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                        exec.risk_score < 3.0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                        exec.risk_score < 7.0 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        "bg-rose-50 text-rose-700 border border-rose-100"
                      }`}>
                        {exec.risk_score ? exec.risk_score.toFixed(1) : "0.0"}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-center font-bold font-mono text-[10px]">
                      <span className={
                        exec.status === "COMPLETED" ? "text-emerald-600" :
                        exec.status === "EXECUTING" ? "text-amber-600 animate-pulse" :
                        exec.status === "PENDING_APPROVAL" ? "text-amber-600" :
                        "text-rose-600"
                      }>
                        {exec.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => setActiveExecutionId(exec.id)}
                        className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 rounded-lg text-[10px] font-bold transition shadow-sm"
                      >
                        Console
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Terminal Modal overlay */}
      {activeExecutionId && (
        <TerminalConsole
          executionId={activeExecutionId}
          onClose={() => setActiveExecutionId(null)}
        />
      )}
    </div>
  );
}
