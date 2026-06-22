"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Mock data representing recent execution records in SafeOps DB
const INITIAL_EXECUTIONS = [
  { id: "1", time: "19:54:12", client: "Claude Code", tool: "traverse_documentation", risk: 2.0, status: "COMPLETED", target: "https://nvchad.com/docs/quickstart" },
  { id: "2", time: "19:52:05", client: "Cursor Agent", tool: "simulate_install", risk: 4.0, status: "COMPLETED", target: "Setup Neovim & NvChad" },
  { id: "3", time: "19:48:33", client: "Windsurf", tool: "restart_service", risk: 5.5, status: "PENDING_APPROVAL", target: "postgresql.service" },
  { id: "4", time: "19:41:20", client: "Claude Code", tool: "update_package", risk: 5.0, status: "COMPLETED", target: "neovim" },
  { id: "5", time: "19:33:01", client: "OpenAI Agent", tool: "get_uptime", risk: 1.0, status: "COMPLETED", target: "Host System" },
  { id: "6", time: "19:12:45", client: "Cursor Agent", tool: "remove_package", risk: 7.0, status: "REJECTED", target: "nginx (policy restriction)" }
];

const TUTORIAL_STEPS = [
  {
    title: "1. Generate Agent connection Token",
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
    description: "Launch your editor agent (e.g. Claude Code) and ask it to install packages or setup configurations (like Neovim + NvChad or Emacs). The SafeOps MCP server intercepts the action.",
    tip: "It dry-runs modifications in a sandbox overlay first!"
  },
  {
    title: "4. Review & Authorize Approvals",
    description: "If an agent calls a high-risk command, it pauses and prints an approval URL. Navigate to the 'Approvals' page here, inspect the command arguments, and click 'Authorize Action'.",
    tip: "Approved commands run instantly in the sandbox."
  },
  {
    title: "5. State snapshot Rollbacks",
    description: "If a command fails or breaks your environment during setup, SafeOps automatically restores files from target config snapshots taken before execution.",
    tip: "You can also trigger manual restores in the Rollback Center."
  }
];

export default function OverviewPage() {
  const [executions, setExecutions] = useState(INITIAL_EXECUTIONS);
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialIndex, setTutorialIndex] = useState(0);

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
          <h2 className="text-2xl font-bold tracking-tight text-white">System Governance Overview</h2>
          <p className="text-zinc-400 text-sm mt-1">Real-time threat diagnostics, risk modeling, and administrative authorization logs.</p>
        </div>
        {!showTutorial && (
          <button
            onClick={() => { setShowTutorial(true); setTutorialIndex(0); }}
            className="px-3 py-1.5 bg-zinc-900 border border-cyber-border text-zinc-300 hover:text-white rounded-lg text-xs font-mono transition"
          >
            Show Onboarding Tutorial
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
            className="bg-zinc-950 border border-cyber-cyan/30 rounded-xl p-6 shadow-glow relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <button 
                onClick={() => setShowTutorial(false)}
                className="text-zinc-500 hover:text-white text-xs font-mono"
              >
                ✕ Skip
              </button>
            </div>
            
            <div className="flex flex-col gap-3 max-w-3xl">
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyber-cyan uppercase">
                Interactive Onboarding Guide // Step {tutorialIndex + 1} of {TUTORIAL_STEPS.length}
              </span>
              
              <h3 className="text-lg font-bold text-white tracking-tight">
                {TUTORIAL_STEPS[tutorialIndex].title}
              </h3>
              
              <p className="text-sm text-zinc-300 leading-relaxed">
                {TUTORIAL_STEPS[tutorialIndex].description}
              </p>
              
              <div className="bg-[#121214] border border-cyber-border rounded-lg p-3 text-xs text-zinc-400 mt-2">
                💡 <strong className="text-zinc-200">Tip:</strong> {TUTORIAL_STEPS[tutorialIndex].tip}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-1">
                  {TUTORIAL_STEPS.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`w-2 h-2 rounded-full transition-all ${idx === tutorialIndex ? "bg-cyber-cyan w-4" : "bg-zinc-800"}`}
                    />
                  ))}
                </div>
                
                <div className="flex gap-2">
                  {tutorialIndex > 0 && (
                    <button
                      onClick={prevStep}
                      className="px-3 py-1.5 bg-zinc-900 border border-cyber-border text-zinc-300 hover:text-white rounded-lg text-xs font-mono transition"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={nextStep}
                    className="px-4 py-1.5 bg-cyber-cyan text-zinc-950 hover:bg-cyber-cyan/95 rounded-lg text-xs font-bold transition"
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
        
        {/* KPI 1: Health Score */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 glow-card flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-zinc-400 text-xs uppercase tracking-wider font-mono">
            Security Health
            <svg className="w-4 h-4 text-cyber-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-bold text-white tracking-tight">98</span>
            <span className="text-zinc-500 text-sm">/ 100</span>
          </div>
          <div className="text-[10px] text-cyber-cyan font-mono mt-2">🛡️ Sandbox isolation active</div>
        </div>

        {/* KPI 2: Active Agents */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 glow-card flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-zinc-400 text-xs uppercase tracking-wider font-mono">
            Connected Clients
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-bold text-white tracking-tight">4</span>
            <span className="text-zinc-500 text-sm">active sessions</span>
          </div>
          <div className="text-[10px] text-zinc-400 font-mono mt-2">Claude, Cursor, Windsurf, Antigravity</div>
        </div>

        {/* KPI 3: Pending Approvals */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 glow-card flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-zinc-400 text-xs uppercase tracking-wider font-mono">
            Pending Reviews
            <svg className="w-4 h-4 text-cyber-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-bold text-cyber-amber tracking-tight">1</span>
            <span className="text-zinc-500 text-sm">action blocked</span>
          </div>
          <div className="text-[10px] text-cyber-amber font-mono mt-2">Needs operator signoff</div>
        </div>

        {/* KPI 4: Audit Verification */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 glow-card flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-zinc-400 text-xs uppercase tracking-wider font-mono">
            Ledger Audit
            <svg className="w-4 h-4 text-cyber-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-sm font-bold text-cyber-emerald uppercase tracking-wider font-mono">VERIFIED</span>
          </div>
          <div className="text-[10px] text-cyber-emerald font-mono mt-2">SHA256 Hash chain validated</div>
        </div>

      </div>

      {/* Executions Table */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-cyber-border flex items-center justify-between">
          <h3 className="font-mono text-sm font-semibold text-white">// RECENT AGENT EXECUTIONS</h3>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyber-cyan shadow-glow animate-pulse" />
            <span className="text-[10px] text-zinc-400 font-mono">Real-time socket log stream active</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyber-border bg-[#18181b]/30 text-zinc-400 text-xs font-mono">
                <th className="py-3.5 px-6">Timestamp</th>
                <th className="py-3.5 px-6">Client Agent</th>
                <th className="py-3.5 px-6">Tool Called</th>
                <th className="py-3.5 px-6">Target Resource</th>
                <th className="py-3.5 px-6 text-center">Risk Score</th>
                <th className="py-3.5 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-cyber-border">
              {executions.map((exec) => (
                <tr key={exec.id} className="hover:bg-[#18181b]/20 transition">
                  <td className="py-3.5 px-6 font-mono text-zinc-500 text-xs">{exec.time}</td>
                  <td className="py-3.5 px-6 font-semibold text-zinc-200">{exec.client}</td>
                  <td className="py-3.5 px-6"><code className="text-cyber-cyan text-xs font-mono">{exec.tool}()</code></td>
                  <td className="py-3.5 px-6 text-zinc-400 font-mono text-xs">{exec.target}</td>
                  <td className="py-3.5 px-6 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      exec.risk < 3.0 ? "bg-cyber-emerald/10 text-cyber-emerald border border-cyber-emerald/20" :
                      exec.risk < 7.0 ? "bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/20" :
                      "bg-cyber-rose/10 text-cyber-rose border border-cyber-rose/20"
                    }`}>
                      {exec.risk.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-right font-bold text-xs font-mono">
                    <span className={
                      exec.status === "COMPLETED" ? "text-cyber-emerald" :
                      exec.status === "PENDING_APPROVAL" ? "text-cyber-amber" :
                      "text-cyber-rose"
                    }>
                      {exec.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
