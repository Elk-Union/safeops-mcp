"use client";

import React, { useState, useEffect } from "react";

const ROLE_MAP: { [key: string]: string } = {
  "277df547-7066-4ca5-ab8f-35dccf9a7673": "superadmin",
  "660f44b2-4cfb-44a0-a406-1f72cf8cad60": "admin",
  "6e2489e8-4572-49c2-a4bc-6da507a1d0ec": "operator",
  "85d8e5c1-6041-4e1c-9a9b-4ac945d49082": "reader",
};

export default function ConnectedAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("6e2489e8-4572-49c2-a4bc-6da507a1d0ec"); // operator UUID
  const [whitelist, setWhitelist] = useState("127.0.0.1");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch("http://localhost:8000/api/v1/clients/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load client agents registry");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setAgents(data);
      }
    } catch (err: any) {
      setError(err.message || "Could not retrieve clients catalog");
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("safeops_token");
    window.location.reload();
  };

  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setError(null);
    setGeneratedToken(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch("http://localhost:8000/api/v1/clients/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          role_id: roleId,
          ip_whitelist: whitelist || null,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to register client agent");
      }

      const data = await response.json();
      setGeneratedToken(data.api_token);
      setName("");
      fetchClients();
    } catch (err: any) {
      setError(err.message || "Error registering new client agent");
    }
  };

  const handleRevokeAgent = async (id: string) => {
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/clients/${id}`, {
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
        throw new Error("Failed to revoke client session");
      }

      fetchClients();
    } catch (err: any) {
      setError(err.message || "Error revoking client credentials");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-800">Client Agent Registries</h2>
        <p className="text-slate-500 text-xs mt-1">Manage connection keys, whitelist IPs, and assign governance scopes for connecting editors.</p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Register Agent Form */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
          <h3 className="font-mono text-[10px] tracking-wider font-bold text-slate-400 uppercase">Register Client Agent</h3>
          
          <form onSubmit={handleRegisterAgent} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              Client Name
              <input
                type="text"
                placeholder="e.g. Claude Code Local"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              Governance Role
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
              >
                {Object.entries(ROLE_MAP).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              IP Whitelist CIDR
              <input
                type="text"
                placeholder="e.g. 127.0.0.1, 10.0.0.0/16"
                value={whitelist}
                onChange={(e) => setWhitelist(e.target.value)}
                className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>

            <button type="submit" className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition mt-2">
              Register Agent Session
            </button>
          </form>

          {/* Generated token display banner */}
          {generatedToken && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col gap-2 mt-2">
              <span className="text-[10px] font-mono text-emerald-700 font-bold uppercase">Token Generated Successfully</span>
              <p className="text-[10px] text-slate-500 leading-normal">Copy this token into your editor configuration settings. It will not be shown again.</p>
              <code className="bg-slate-900 p-2.5 rounded-lg text-xs text-white font-mono border border-slate-800 break-all">
                {generatedToken}
              </code>
            </div>
          )}
        </div>

        {/* Active Agents list */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-mono text-[10px] tracking-wider font-bold text-slate-400 uppercase">Registered Clients</h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading client agents catalog...</div>
          ) : agents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">No client agents registered in the database.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-xs font-mono">
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-6">Assigned Role</th>
                  <th className="py-3 px-6">IP Constraints</th>
                  <th className="py-3 px-6 font-mono text-center">Active Status</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50/40 transition">
                    <td className="py-4 px-6 font-bold text-slate-700">{agent.name}</td>
                    <td className="py-4 px-6 font-mono text-[10px] text-indigo-600 uppercase font-bold">
                      {ROLE_MAP[agent.role_id] || agent.role_id}
                    </td>
                    <td className="py-4 px-6 font-mono text-[10px] text-slate-500">{agent.ip_whitelist || "None Whitelisted"}</td>
                    <td className="py-4 px-6 text-center font-bold font-mono">
                      <span className={agent.is_active ? "text-emerald-600" : "text-slate-400"}>
                        {agent.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleRevokeAgent(agent.id)}
                        className="text-rose-600 hover:text-rose-700 font-semibold hover:underline"
                      >
                        Revoke
                      </button>
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
