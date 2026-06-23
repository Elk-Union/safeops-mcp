"use client";

import React, { useState, useEffect } from "react";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch("http://localhost:8000/api/v1/audit/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load audit ledger logs");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err: any) {
      setError(err.message || "Could not retrieve audit ledger logs");
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("safeops_token");
    window.location.reload();
  };

  const handleVerifyLedger = async () => {
    setVerifying(true);
    setVerificationResult(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch("http://localhost:8000/api/v1/audit/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setVerificationResult(`SUCCESS: Cryptographic Hash Chain Integrity verified. ${data.message}`);
      } else {
        setVerificationResult(`FAILED: Ledger validation failed: ${data.detail || "Tampering suspected"}`);
      }
    } catch (err: any) {
      setVerificationResult(`ERROR: Ledger connection failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const filteredLogs = logs.filter(
    (l) =>
      (l.client_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.tool_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-800">Audit Ledger</h2>
          <p className="text-slate-500 text-xs mt-0.5">Tamper-proof history timeline of all agent operations.</p>
        </div>

        {/* Verification Trigger */}
        <button
          onClick={handleVerifyLedger}
          disabled={verifying}
          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-lg text-xs font-bold text-slate-700 shadow-sm transition flex items-center gap-1.5"
        >
          {verifying ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-indigo-650" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify Ledger
            </>
          )}
        </button>
      </div>

      {verificationResult && (
        <div className={`p-3 border rounded-xl text-xs font-mono font-bold ${
          verificationResult.startsWith("SUCCESS") 
            ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
            : "bg-rose-50 border-rose-200 text-rose-700"
        }`}>
          {verificationResult}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Search Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <input
          type="text"
          placeholder="Filter logs by client agent or tool name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 hover:border-slate-355 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-650 focus:bg-white transition"
        />
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center text-slate-400 text-xs">Loading ledger blocks...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">No audit logs match your search.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-[10px] font-mono">
                  <th className="py-2.5 px-5">Time</th>
                  <th className="py-2.5 px-5">Client Agent</th>
                  <th className="py-2.5 px-5">Tool</th>
                  <th className="py-2.5 px-5">Approved By</th>
                  <th className="py-2.5 px-5 text-center">Risk</th>
                  <th className="py-2.5 px-5 text-center">Status</th>
                  <th className="py-2.5 px-5 text-right">Row Hash</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/20 transition">
                    <td className="py-3 px-5 font-mono text-slate-400 text-[10px]">
                      {new Date(log.timestamp + "Z").toLocaleString()}
                    </td>
                    <td className="py-3 px-5 font-bold text-slate-700">{log.client_name}</td>
                    <td className="py-3 px-5 font-mono text-[11px] text-indigo-655 font-bold">
                      {log.tool_name}
                    </td>
                    <td className="py-3 px-5 text-slate-500 font-mono text-[10px]">
                      {log.approved_by_email || "System Auto"}
                    </td>
                    <td className="py-3 px-5 text-center font-mono font-bold text-slate-655">
                      {log.risk_score ? log.risk_score.toFixed(1) : "0.0"}
                    </td>
                    <td className="py-3 px-5 text-center font-bold font-mono text-[10px]">
                      <span className={log.status === "COMPLETED" ? "text-emerald-600" : "text-rose-600"}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[9px] text-slate-400 truncate max-w-[120px]" title={log.row_hash}>
                      {log.row_hash}
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
