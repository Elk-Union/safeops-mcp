"use client";

import React, { useState } from "react";

// Mock agents list
const INITIAL_AGENTS = [
  { id: "1", name: "Claude Code Dev", role: "developer", whitelist: "127.0.0.1", lastActive: "19:54:12", status: "ACTIVE" },
  { id: "2", name: "Cursor Local Workspace", role: "operator", whitelist: "10.0.0.0/16", lastActive: "19:52:05", status: "ACTIVE" },
  { id: "3", name: "Windsurf Production runner", role: "admin", whitelist: "192.168.1.50", lastActive: "19:48:33", status: "ACTIVE" }
];

export default function ConnectedAgentsPage() {
  const [agents, setAgents] = useState(INITIAL_AGENTS);
  const [name, setName] = useState("");
  const [role, setRole] = useState("developer");
  const [whitelist, setWhitelist] = useState("127.0.0.1");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const handleRegisterAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const token = `so_tok_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    const newAgent = {
      id: (agents.length + 1).toString(),
      name,
      role,
      whitelist,
      lastActive: "Never",
      status: "ACTIVE"
    };

    setAgents([...agents, newAgent]);
    setGeneratedToken(token);
    setName("");
  };

  const handleRevokeAgent = (id: string) => {
    setAgents(agents.filter((a) => a.id !== id));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Client Agent Registries</h2>
        <p className="text-zinc-400 text-sm mt-1">Manage connection keys, whitelist IPs, and assign governance scopes for connecting editors.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Register Agent Form */}
        <div className="lg:col-span-1 bg-cyber-card border border-cyber-border rounded-xl p-6 flex flex-col gap-4">
          <h3 className="font-mono text-sm font-semibold text-white">// REGISTER CLIENT AGENT</h3>
          
          <form onSubmit={handleRegisterAgent} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-400">
              CLIENT NAME:
              <input
                type="text"
                placeholder="e.g. Claude Code Local"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[#0b0b0d] border border-cyber-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-400">
              GOVERNANCE ROLE:
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-[#0b0b0d] border border-cyber-border rounded-lg p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="superadmin">superadmin (unrestricted)</option>
                <option value="admin">admin (full credentials)</option>
                <option value="operator">operator (writes permitted)</option>
                <option value="developer">developer (staging writes only)</option>
                <option value="reader">reader (read-only diagnostics)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-400">
              IP WHITELIST CIDR:
              <input
                type="text"
                placeholder="e.g. 127.0.0.1, 10.0.0.0/16"
                value={whitelist}
                onChange={(e) => setWhitelist(e.target.value)}
                className="bg-[#0b0b0d] border border-cyber-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan"
              />
            </div>

            <button type="submit" className="py-2.5 bg-cyber-cyan text-zinc-950 font-bold text-xs rounded-lg transition mt-2">
              Register Agent Session
            </button>
          </form>

          {/* Generated token display banner */}
          {generatedToken && (
            <div className="bg-cyber-emerald/10 border border-cyber-emerald/25 rounded-lg p-4 flex flex-col gap-2 mt-2">
              <span className="text-[10px] font-mono text-cyber-emerald font-bold uppercase">✓ TOKEN GENERATED SUCCESSFULLY</span>
              <p className="text-[10px] text-zinc-400 leading-normal">Copy this token into your editor configuration settings. It will not be shown again.</p>
              <code className="bg-[#0b0b0d] p-2 rounded text-xs text-white font-mono border border-cyber-border break-all">
                {generatedToken}
              </code>
            </div>
          )}
        </div>

        {/* Active Agents list */}
        <div className="lg:col-span-2 bg-cyber-card border border-cyber-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-cyber-border">
            <h3 className="font-mono text-sm font-semibold text-white">// REGISTERED CLIENTS</h3>
          </div>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyber-border bg-[#18181b]/30 text-zinc-400 text-xs font-mono">
                <th className="py-3 px-6">Name</th>
                <th className="py-3 px-6">Assigned Role</th>
                <th className="py-3 px-6">IP Constraints</th>
                <th className="py-3 px-6 font-mono">Last Active</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-cyber-border">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-[#18181b]/10 transition">
                  <td className="py-4 px-6 font-semibold text-zinc-200">{agent.name}</td>
                  <td className="py-4 px-6 font-mono text-xs text-cyber-cyan uppercase">{agent.role}</td>
                  <td className="py-4 px-6 font-mono text-xs text-zinc-400">{agent.whitelist}</td>
                  <td className="py-4 px-6 font-mono text-xs text-zinc-500">{agent.lastActive}</td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleRevokeAgent(agent.id)}
                      className="text-cyber-rose hover:underline text-xs"
                    >
                      Revoke
                    </button>
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
