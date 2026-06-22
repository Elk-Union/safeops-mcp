"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TUTORIAL_STEPS = [
  {
    title: "1. Generate Agent Connection Token",
    description: "Navigate to the 'Connected Agents' page. Click 'Register Client' to create an authorization token (e.g. for Claude Code or Cursor). This token maps permissions to the agent.",
    tip: "Keep the token secret; it dictates system access."
  },
  {
    title: "2. Define Security Policies",
    description: "Go to the 'Policies Editor'. Register rules specifying which system actions (like update_package or restart_service) are allowed automatically, blocked (denied), or require approval.",
    tip: "E.g., Allow updates on staging, but require approval on production."
  },
  {
    title: "3. Run Agent Commands",
    description: "Launch your editor agent (e.g. Claude Code) and ask it to install packages or setup configurations. The SafeOps MCP server intercepts the action.",
    tip: "It dry-runs modifications in a sandbox overlay first!"
  },
  {
    title: "4. Review & Authorize Approvals",
    description: "If an agent calls a high-risk command, it pauses and prints an approval URL. Navigate to the 'Approvals Queue' page here, inspect the command arguments, and click 'Authorize Action'.",
    tip: "Approved commands run instantly in the sandbox."
  },
  {
    title: "5. State Snapshot Rollbacks",
    description: "If a command fails or breaks your environment during setup, SafeOps automatically restores files from target config snapshots taken before execution.",
    tip: "You can also trigger manual restores in the Rollback Center."
  }
];

export default function OverviewPage() {
  const [executions, setExecutions] = useState<any[]>([]);
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [stats, setStats] = useState({
    clientsCount: 0,
    pendingApprovalsCount: 0,
    auditLogsCount: 0,
    toolsCount: 0,
    verificationStatus: "Checking...",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      // 1. Fetch Clients
      const clientsRes = await fetch("http://localhost:8000/api/v1/clients/", { headers });
      if (clientsRes.status === 401) {
        handleUnauthorized();
        return;
      }
      const clientsData = await clientsRes.json().catch(() => []);

      // 2. Fetch Pending Approvals
      const approvalsRes = await fetch("http://localhost:8000/api/v1/approvals/?status_filter=PENDING", { headers });
      const approvalsData = await approvalsRes.json().catch(() => []);

      // 3. Fetch Audit Logs
      const auditRes = await fetch("http://localhost:8000/api/v1/audit/", { headers });
      const auditData = await auditRes.json().catch(() => []);

      // 4. Fetch Tools Catalog
      const toolsRes = await fetch("http://localhost:8000/api/v1/tools/", { headers });
      const toolsData = await toolsRes.json().catch(() => []);

      // 5. Verify Ledger
      const verifyRes = await fetch("http://localhost:8000/api/v1/audit/verify", { method: "POST", headers });
      const verifyData = await verifyRes.json().catch(() => ({ status: "unknown" }));

      setStats({
        clientsCount: Array.isArray(clientsData) ? clientsData.length : 0,
        pendingApprovalsCount: Array.isArray(approvalsData) ? approvalsData.length : 0,
        auditLogsCount: Array.isArray(auditData) ? auditData.length : 0,
        toolsCount: Array.isArray(toolsData) ? toolsData.length : 0,
        verificationStatus: verifyData.status === "verified" ? "INTEGRITY INTACT" : "TAMPERED/UNVERIFIED",
      });

      if (Array.isArray(auditData)) {
        setExecutions(auditData.slice(0, 10)); // Show latest 10 executions
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

  const nextStep = () => {
    if (tutorialIndex < TUTORIAL_STEPS.length - 1) {
      setTutorialIndex(tutorialIndex + 1);
    } else {
      setShowTutorial(false);
    }
  };

  const prevStep = () => {
    if (tutorialIndex > 0) {
      setTutorialIndex(tutorialIndex - 1);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">System Governance Overview</h2>
          <p className="text-slate-500 text-xs mt-1">Real-time threat diagnostics, risk modeling, and administrative authorization logs.</p>
        </div>
        {!showTutorial && (
          <button
            onClick={() => { setShowTutorial(true); setTutorialIndex(0); }}
            className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 rounded-xl text-xs font-semibold shadow-sm transition"
          >
            Show Onboarding Guide
          </button>
        )}
      </div>

      {/* Onboarding Interactive Tutorial Wizard */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <button 
                onClick={() => setShowTutorial(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
            
            <div className="flex flex-col gap-3 max-w-3xl">
              <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-600 uppercase">
                Interactive Onboarding Guide // Step {tutorialIndex + 1} of {TUTORIAL_STEPS.length}
              </span>
              
              <h3 className="text-base font-bold text-slate-800 tracking-tight">
                {TUTORIAL_STEPS[tutorialIndex].title}
              </h3>
              
              <p className="text-xs text-slate-600 leading-relaxed">
                {TUTORIAL_STEPS[tutorialIndex].description}
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-500 mt-1 flex flex-col gap-0.5">
                <span className="text-slate-700 font-semibold">Tip:</span>
                <span>{TUTORIAL_STEPS[tutorialIndex].tip}</span>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-1.5">
                  {TUTORIAL_STEPS.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`w-1.5 h-1.5 rounded-full transition-all ${idx === tutorialIndex ? "bg-indigo-600 w-3.5" : "bg-slate-200"}`}
                    />
                  ))}
                </div>
                
                <div className="flex gap-2">
                  {tutorialIndex > 0 && (
                    <button
                      onClick={prevStep}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-semibold transition"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={nextStep}
                    className="px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    {tutorialIndex === TUTORIAL_STEPS.length - 1 ? "Get Started" : "Next Step"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* KPI 1: Active Clients */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 glow-card flex flex-col justify-between h-36 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase tracking-wider font-mono font-bold">
            Connected Clients
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{stats.clientsCount}</span>
            <span className="text-slate-400 text-xs font-semibold">active sessions</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-2 truncate">Registered agent connection keys</div>
        </div>

        {/* KPI 2: Pending Approvals */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 glow-card flex flex-col justify-between h-36 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase tracking-wider font-mono font-bold">
            Pending Reviews
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className={`text-3xl font-extrabold tracking-tight ${stats.pendingApprovalsCount > 0 ? "text-amber-600" : "text-slate-800"}`}>
              {stats.pendingApprovalsCount}
            </span>
            <span className="text-slate-400 text-xs font-semibold">actions blocked</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-2">Requires manual administrative signoff</div>
        </div>

        {/* KPI 3: Tools Count */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 glow-card flex flex-col justify-between h-36 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase tracking-wider font-mono font-bold">
            Catalog Size
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{stats.toolsCount}</span>
            <span className="text-slate-400 text-xs font-semibold">governed tools</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-2">Exposed system control actions</div>
        </div>

        {/* KPI 4: Audit Verification */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 glow-card flex flex-col justify-between h-36 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase tracking-wider font-mono font-bold">
            Ledger Audit
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className={`text-xs font-bold font-mono tracking-wider px-2 py-0.5 rounded ${
              stats.verificationStatus === "INTEGRITY INTACT" 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                : "bg-rose-50 text-rose-700 border border-rose-100"
            }`}>
              {stats.verificationStatus}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-2">Cryptographic row hashes verified</div>
        </div>

      </div>

      {/* Executions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-mono text-[10px] tracking-wider font-bold text-slate-400 uppercase">
            Recent Agent Executions
          </h3>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            Refresh Logs
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {loading && executions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">Querying latest execution logs...</div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600 text-xs">{error}</div>
          ) : executions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">No execution logs registered in the database ledger.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-xs font-mono">
                  <th className="py-3 px-6">Timestamp</th>
                  <th className="py-3 px-6">Client Agent</th>
                  <th className="py-3 px-6">Tool Called</th>
                  <th className="py-3 px-6 text-center">Risk Score</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {executions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-slate-50/40 transition">
                    <td className="py-3.5 px-6 font-mono text-slate-400 text-[10px]">
                      {new Date(exec.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-700">{exec.client_name}</td>
                    <td className="py-3.5 px-6">
                      <code className="text-indigo-600 font-bold bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded font-mono">
                        {exec.tool_name}()
                      </code>
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        exec.risk_score < 3.0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                        exec.risk_score < 7.0 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        "bg-rose-50 text-rose-700 border border-rose-100"
                      }`}>
                        {exec.risk_score ? exec.risk_score.toFixed(1) : "0.0"}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold font-mono">
                      <span className={
                        exec.status === "COMPLETED" ? "text-emerald-600" :
                        exec.status === "PENDING" ? "text-amber-600" :
                        "text-rose-600"
                      }>
                        {exec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
