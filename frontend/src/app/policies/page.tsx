"use client";

import React, { useState, useEffect } from "react";

const ROLE_MAP: { [key: string]: string } = {
  "277df547-7066-4ca5-ab8f-35dccf9a7673": "superadmin",
  "660f44b2-4cfb-44a0-a406-1f72cf8cad60": "admin",
  "6e2489e8-4572-49c2-a4bc-6da507a1d0ec": "operator",
  "85d8e5c1-6041-4e1c-9a9b-4ac945d49082": "reader",
};

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPolicy, setNewPolicy] = useState({
    role_id: "6e2489e8-4572-49c2-a4bc-6da507a1d0ec",
    tool_id: "",
    environment: "*",
    effect: "allow",
    restrictions: ""
  });

  useEffect(() => {
    fetchPoliciesAndTools();
  }, []);

  const fetchPoliciesAndTools = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch Tools
      const toolsRes = await fetch("http://localhost:8000/api/v1/tools/", { headers });
      if (toolsRes.status === 401) {
        handleUnauthorized();
        return;
      }
      const toolsData = await toolsRes.json().catch(() => []);
      if (Array.isArray(toolsData)) {
        setTools(toolsData);
        if (toolsData.length > 0) {
          setNewPolicy((prev) => ({ ...prev, tool_id: toolsData[0].id }));
        }
      }

      // Fetch Policies
      const policiesRes = await fetch("http://localhost:8000/api/v1/policies/", { headers });
      const policiesData = await policiesRes.json().catch(() => []);
      if (Array.isArray(policiesData)) {
        setPolicies(policiesData);
      }
    } catch (err: any) {
      setError("Could not retrieve governance policies list");
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("safeops_token");
    window.location.reload();
  };

  const handleAddPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch("http://localhost:8000/api/v1/policies/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role_id: newPolicy.role_id,
          tool_id: newPolicy.tool_id,
          environment: newPolicy.environment,
          effect: newPolicy.effect,
          rules_json: newPolicy.restrictions ? { restrictions: newPolicy.restrictions } : null,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to create policy rule");
      }

      await fetchPoliciesAndTools();
      setShowAddForm(false);
      setNewPolicy((prev) => ({
        ...prev,
        environment: "*",
        effect: "allow",
        restrictions: ""
      }));
    } catch (err: any) {
      setError(err.message || "Could not register access policy rule");
    }
  };

  const handleDeletePolicy = async (id: string) => {
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/policies/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to delete policy rule");
      }

      await fetchPoliciesAndTools();
    } catch (err: any) {
      setError(err.message || "Error revoking policy rule");
    }
  };

  const getToolName = (toolId: string) => {
    const tool = tools.find((t) => t.id === toolId);
    return tool ? `${tool.name}` : `ID: ${toolId}`;
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-800">Policies Configuration</h2>
          <p className="text-slate-500 text-xs mt-0.5">Configure role permissions, environments, and validation conditions.</p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm transition animate-fade-in"
        >
          {showAddForm ? "Cancel" : "Add Policy Rule"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Add Policy Form */}
      {showAddForm && (
        <form onSubmit={handleAddPolicy} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 max-w-xl shadow-sm">
          <h3 className="font-mono text-[9px] tracking-wider font-bold text-slate-400 uppercase">Create Policy Rule</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
              Role Scope
              <select
                value={newPolicy.role_id}
                onChange={(e) => setNewPolicy({ ...newPolicy, role_id: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
              >
                {Object.entries(ROLE_MAP).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
              Governed Tool Target
              <select
                value={newPolicy.tool_id}
                onChange={(e) => setNewPolicy({ ...newPolicy, tool_id: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
                required
              >
                {tools.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}()</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
              Environment
              <select
                value={newPolicy.environment}
                onChange={(e) => setNewPolicy({ ...newPolicy, environment: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
              >
                <option value="*">All Environments</option>
                <option value="production">production</option>
                <option value="staging">staging</option>
                <option value="development">development</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
              Governance Effect
              <select
                value={newPolicy.effect}
                onChange={(e) => setNewPolicy({ ...newPolicy, effect: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none"
              >
                <option value="allow">ALLOW</option>
                <option value="deny">DENY</option>
                <option value="approval_required">APPROVAL REQUIRED</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            Restrictions / Comments
            <input
              type="text"
              placeholder="e.g. Only service: nginx, or requires manager review"
              value={newPolicy.restrictions}
              onChange={(e) => setNewPolicy({ ...newPolicy, restrictions: e.target.value })}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg p-2 text-xs text-slate-850 focus:outline-none focus:border-indigo-650 focus:bg-white transition"
            />
          </div>

          <button type="submit" className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition mt-2">
            Confirm Rule Addition
          </button>
        </form>
      )}

      {/* Rules list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400 text-xs">Loading registered policies...</div>
        ) : policies.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No governance policies registered. Zero Trust enforced.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-[10px] font-mono">
                <th className="py-2.5 px-5">Role Scope</th>
                <th className="py-2.5 px-5">Governed Tool</th>
                <th className="py-2.5 px-5">Environment</th>
                <th className="py-2.5 px-5">Effect</th>
                <th className="py-2.5 px-5">Conditions</th>
                <th className="py-2.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {policies.map((pol) => (
                <tr key={pol.id} className="hover:bg-slate-50/20 transition">
                  <td className="py-3 px-5 text-slate-800 font-bold">
                    {ROLE_MAP[pol.role_id] || pol.role_id}
                  </td>
                  <td className="py-3 px-5">
                    <code className="text-indigo-600 font-bold bg-indigo-50/50 border border-indigo-100/30 px-1.5 py-0.5 rounded font-mono text-[11px]">
                      {getToolName(pol.tool_id)}
                    </code>
                  </td>
                  <td className="py-3 px-5 uppercase font-bold text-slate-400 font-mono text-[9px]">{pol.environment}</td>
                  <td className="py-3 px-5 font-bold font-mono text-[10px]">
                    <span className={
                      pol.effect === "allow" ? "text-emerald-600" :
                      pol.effect === "approval_required" ? "text-amber-600" :
                      "text-rose-600"
                    }>
                      {pol.effect.toUpperCase().replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-slate-500">{pol.rules_json?.restrictions || "None"}</td>
                  <td className="py-3 px-5 text-right">
                    <button
                      onClick={() => handleDeletePolicy(pol.id)}
                      className="text-rose-600 hover:text-rose-700 font-bold transition hover:underline"
                    >
                      Delete
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
