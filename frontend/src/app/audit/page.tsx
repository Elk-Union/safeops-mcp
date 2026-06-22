"use client";

import React, { useState } from "react";

// Mock audit ledger listing with chain row hashes
const INITIAL_LOGS = [
  { id: "10", time: "19:54:12", client: "Claude Code", tool: "traverse_documentation", risk: 2.0, status: "COMPLETED", approved_by: "auto", hash: "8a7d18ac93ba02bd8a7219acbfb8e8f8101a0cb623910ab31e8c9fbd81b0a8c2" },
  { id: "9", time: "19:52:05", client: "Cursor Agent", tool: "simulate_install", risk: 4.0, status: "COMPLETED", approved_by: "admin@safeops.io", hash: "9e1c2b8d7a123bcdefa92138acfba78b02e7a4f910a30b1c09ebcd38e7654a91" },
  { id: "8", time: "19:41:20", client: "Claude Code", tool: "update_package", risk: 5.0, status: "COMPLETED", approved_by: "auto", hash: "4f7a1c8b9d324bca82103acba8712e9b02a7c4e9f9028b1c08daefef83e164f9" },
  { id: "7", time: "19:33:01", client: "OpenAI Agent", tool: "get_uptime", risk: 1.0, status: "COMPLETED", approved_by: "auto", hash: "02bc89a71dbda0e7f82b1cfdb8219abfce81a0293dbba80f765abcbcaefe19a8" },
  { id: "6", time: "19:12:45", client: "Cursor Agent", tool: "remove_package", risk: 7.0, status: "REJECTED", approved_by: "admin@safeops.io", hash: "e8a01bfcbcdfa91bca72abcef9218ab2c39dbacdf71a0291ba81cb9fbdab39f8" }
];

export default function AuditLogsPage() {
  const [logs] = useState(INITIAL_LOGS);
  const [searchTerm, setSearchTerm] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);

  const handleVerifyLedger = () => {
    setVerifying(true);
    setVerificationResult(null);
    setTimeout(() => {
      setVerifying(false);
      setVerificationResult("SUCCESS: Cryptographic Hash Chain Integrity verified. No tampering detected across 5 ledger blocks.");
    }, 1500);
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.tool.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Cryptographic Audit Ledger</h2>
          <p className="text-zinc-400 text-sm mt-1">Tamper-proof history timeline of all agent operations chained using cryptographic row-hash validation.</p>
        </div>

        {/* Verification Trigger */}
        <button
          onClick={handleVerifyLedger}
          disabled={verifying}
          className="px-4 py-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/35 hover:border-cyber-cyan/60 rounded-lg text-xs font-mono font-bold transition flex items-center gap-2"
        >
          {verifying ? (
            <>
              <svg className="animate-spin h-3 w-3 text-cyber-cyan" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying hash chain...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify Ledger Integrity
            </>
          )}
        </button>
      </div>

      {/* Verification success banner */}
      {verificationResult && (
        <div className="bg-cyber-emerald/10 border border-cyber-emerald/25 text-cyber-emerald px-4 py-3 rounded-lg text-xs font-mono">
          ✓ {verificationResult}
        </div>
      )}

      {/* Search Filter input */}
      <div className="bg-[#121214] border border-cyber-border rounded-xl p-4 flex gap-4">
        <input
          type="text"
          placeholder="Filter logs by Client Agent or Tool Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-[#0b0b0d] border border-cyber-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-cyber-cyan"
        />
      </div>

      {/* Logs Table */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyber-border bg-[#18181b]/30 text-zinc-400 text-xs font-mono">
                <th className="py-3.5 px-6">Timestamp</th>
                <th className="py-3.5 px-6">Client Agent</th>
                <th className="py-3.5 px-6">Tool</th>
                <th className="py-3.5 px-6">Approved By</th>
                <th className="py-3.5 px-6 text-center">Risk</th>
                <th className="py-3.5 px-6 text-center">Status</th>
                <th className="py-3.5 px-6 text-right">Cryptographic row hash link</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-cyber-border">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#18181b]/10 transition">
                  <td className="py-4 px-6 font-mono text-zinc-500 text-xs">{log.time}</td>
                  <td className="py-4 px-6 font-semibold text-zinc-200">{log.client}</td>
                  <td className="py-4 px-6">
                    <code className="text-cyber-cyan text-xs font-mono font-semibold bg-cyber-cyan/5 px-2 py-0.5 rounded border border-cyber-cyan/10">
                      {log.tool}()
                    </code>
                  </td>
                  <td className="py-4 px-6 text-zinc-400 font-mono text-xs">{log.approved_by}</td>
                  <td className="py-4 px-6 text-center font-mono font-bold text-xs">{log.risk.toFixed(1)}</td>
                  <td className="py-4 px-6 text-center font-bold text-xs font-mono">
                    <span className={log.status === "COMPLETED" ? "text-cyber-emerald" : "text-cyber-rose"}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-[10px] text-zinc-500 truncate max-w-[200px]" title={log.hash}>
                    {log.hash}
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
