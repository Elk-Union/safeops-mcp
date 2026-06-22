"use client";

import React, { useState } from "react";

// Mock policies mapping client roles to tool executions
const INITIAL_POLICIES = [
  { id: "pol_1", role: "operator", tool: "restart_service", environment: "staging", effect: "ALLOW", restrictions: "Only service: nginx" },
  { id: "pol_2", role: "operator", tool: "restart_service", environment: "production", effect: "APPROVAL_REQUIRED", restrictions: "Requires manager review" },
  { id: "pol_3", role: "developer", tool: "update_package", environment: "staging", effect: "ALLOW", restrictions: "None" },
  { id: "pol_4", role: "developer", tool: "update_package", environment: "production", effect: "APPROVAL_REQUIRED", restrictions: "Requires admin signoff" },
  { id: "pol_5", role: "reader", tool: "*", environment: "*", effect: "DENY", restrictions: "No execution permitted" },
  { id: "pol_6", role: "operator", tool: "restore_database", environment: "production", effect: "APPROVAL_REQUIRED", restrictions: "Requires admin review" }
];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState(INITIAL_POLICIES);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [newPolicy, setNewPolicy] = useState({
    role: "operator",
    tool: "restart_service",
    environment: "*",
    effect: "ALLOW",
    restrictions: ""
  });

  const handleAddPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `pol_${policies.length + 1}`;
    setPolicies([...policies, { id, ...newPolicy }]);
    setShowAddForm(false);
    setNewPolicy({ role: "operator", tool: "restart_service", environment: "*", effect: "ALLOW", restrictions: "" });
  };

  const handleDeletePolicy = (id: string) => {
    setPolicies(policies.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Policies Configuration (RBAC & ABAC)</h2>
          <p className="text-zinc-400 text-sm mt-1">Configure role capabilities, environment overlays, and validation conditions governing tools.</p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-cyber-cyan hover:bg-cyber-cyan/90 text-zinc-950 font-bold rounded-lg text-xs transition"
        >
          {showAddForm ? "Cancel" : "Add Policy Rule"}
        </button>
      </div>

      {/* Add Policy Form */}
      {showAddForm && (
        <form onSubmit={handleAddPolicy} className="bg-cyber-card border border-cyber-border rounded-xl p-6 flex flex-col gap-4 max-w-2xl">
          <h3 className="font-mono text-sm font-semibold text-white">// CREATE POLICY RULE</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-400">
              ROLE:
              <select
                value={newPolicy.role}
                onChange={(e) => setNewPolicy({ ...newPolicy, role: e.target.value })}
                className="bg-[#0b0b0d] border border-cyber-border rounded-lg p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="superadmin">superadmin</option>
                <option value="admin">admin</option>
                <option value="operator">operator</option>
                <option value="developer">developer</option>
                <option value="reader">reader</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-400">
              TOOL TARGET:
              <select
                value={newPolicy.tool}
                onChange={(e) => setNewPolicy({ ...newPolicy, tool: e.target.value })}
                className="bg-[#0b0b0d] border border-cyber-border rounded-lg p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="restart_service">restart_service()</option>
                <option value="update_package">update_package()</option>
                <option value="remove_package">remove_package()</option>
                <option value="deploy_fastapi">deploy_fastapi()</option>
                <option value="restore_database">restore_database()</option>
                <option value="simulate_install">simulate_install()</option>
                <option value="*">* (Wildcard)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-400">
              ENVIRONMENT:
              <select
                value={newPolicy.environment}
                onChange={(e) => setNewPolicy({ ...newPolicy, environment: e.target.value })}
                className="bg-[#0b0b0d] border border-cyber-border rounded-lg p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="*">* (Any Environment)</option>
                <option value="production">production</option>
                <option value="staging">staging</option>
                <option value="development">development</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-400">
              EFFECT RULE:
              <select
                value={newPolicy.effect}
                onChange={(e) => setNewPolicy({ ...newPolicy, effect: e.target.value })}
                className="bg-[#0b0b0d] border border-cyber-border rounded-lg p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="ALLOW">ALLOW</option>
                <option value="DENY">DENY</option>
                <option value="APPROVAL_REQUIRED">APPROVAL_REQUIRED</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-400">
            ARGUMENTS RESTRICTIONS / COMMENTS:
            <input
              type="text"
              placeholder="e.g. Only service: nginx, or requires manager review"
              value={newPolicy.restrictions}
              onChange={(e) => setNewPolicy({ ...newPolicy, restrictions: e.target.value })}
              className="bg-[#0b0b0d] border border-cyber-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan"
            />
          </div>

          <button type="submit" className="py-2.5 bg-cyber-cyan text-zinc-950 font-bold text-xs rounded-lg transition mt-2">
            Confirm Rule Addition
          </button>
        </form>
      )}

      {/* Rules list */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-cyber-border bg-[#18181b]/30 text-zinc-400 text-xs font-mono">
              <th className="py-3.5 px-6">Role Scope</th>
              <th className="py-3.5 px-6">Governed Tool</th>
              <th className="py-3.5 px-6">Environment</th>
              <th className="py-3.5 px-6">Governance Effect</th>
              <th className="py-3.5 px-6">Validation Conditions</th>
              <th className="py-3.5 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-cyber-border">
            {policies.map((pol) => (
              <tr key={pol.id} className="hover:bg-[#18181b]/10 transition font-mono text-xs">
                <td className="py-4 px-6 text-white font-sans font-semibold">{pol.role}</td>
                <td className="py-4 px-6">
                  <code className="text-cyber-cyan font-bold bg-cyber-cyan/5 px-2 py-0.5 rounded border border-cyber-cyan/15">
                    {pol.tool}
                  </code>
                </td>
                <td className="py-4 px-6 uppercase text-zinc-400">{pol.environment}</td>
                <td className="py-4 px-6 font-bold">
                  <span className={
                    pol.effect === "ALLOW" ? "text-cyber-emerald" :
                    pol.effect === "APPROVAL_REQUIRED" ? "text-cyber-amber" :
                    "text-cyber-rose"
                  }>
                    {pol.effect}
                  </span>
                </td>
                <td className="py-4 px-6 text-zinc-400 font-sans">{pol.restrictions}</td>
                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => handleDeletePolicy(pol.id)}
                    className="text-cyber-rose hover:underline"
                  >
                    Delete
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
