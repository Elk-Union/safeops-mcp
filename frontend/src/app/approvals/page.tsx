"use client";

import React, { useState, useEffect } from "react";
import TerminalConsole from "../components/TerminalConsole";

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("PENDING");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);

  useEffect(() => {
    fetchApprovals();
  }, [activeTab]);

  const fetchApprovals = async () => {
    setLoading(true);
    setError(null);
    setSelectedRequest(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/approvals/?status_filter=${activeTab}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load approvals queue");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setRequests(data);
      }
    } catch (err: any) {
      setError(err.message || "Could not retrieve approvals queue");
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("safeops_token");
    window.location.reload();
  };

  const handleDecision = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setActionLoading(true);
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    if (decision === "APPROVED" && selectedRequest?.execution_id) {
      // Pop up the live console window immediately
      setActiveExecutionId(selectedRequest.execution_id);
    }

    try {
      const response = await fetch(`http://localhost:8000/api/v1/approvals/${id}/decide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          decision,
          reason: notes,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Failed to register ${decision.toLowerCase()} action`);
      }

      // Reload lists
      await fetchApprovals();
      setSelectedRequest(null);
      setNotes("");
    } catch (err: any) {
      setError(err.message || "Error submitting decision");
      setActiveExecutionId(null); // Close console if error occurred immediately
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-800">Action Approvals Queue</h2>
          <p className="text-slate-500 text-xs mt-0.5">Authorize or reject administrative system operations requested by agents.</p>
        </div>
        
        {/* Simple Tab switcher */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-0.5 flex gap-0.5 font-mono text-[10px]">
          {["PENDING", "APPROVED", "REJECTED"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === tab 
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/40" 
                  : "text-slate-500 hover:text-slate-950"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* List of Requests */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
              No actions found in this state.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className={`bg-white border rounded-xl p-4 cursor-pointer transition shadow-sm hover:shadow ${
                    selectedRequest?.id === req.id 
                      ? "border-indigo-600 ring-1 ring-indigo-600/10" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <code className="text-indigo-600 text-xs font-mono font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/50">
                        {req.tool_name}
                      </code>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                      req.risk_score < 3.0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                      req.risk_score < 7.0 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                      "bg-rose-50 text-rose-700 border border-rose-100"
                    }`}>
                      Risk: {req.risk_score.toFixed(1)}
                    </span>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-mono text-[10px]">
                    <span className="truncate max-w-[280px]">Args: {JSON.stringify(req.arguments)}</span>
                    <span>{new Date(req.created_at + "Z").toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Panel Detail view */}
        <div className="lg:col-span-1">
          {selectedRequest ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
              <div>
                <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider block">TICKET INSPECTION</span>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">Details</h3>
              </div>

              <div className="flex flex-col gap-3.5 text-xs font-mono divide-y divide-slate-100">
                <div className="pt-1.5">
                  <span className="text-slate-400 block mb-0.5 font-bold text-[9px]">TOOL FUNCTION</span>
                  <span className="text-indigo-600 font-bold text-xs">{selectedRequest.tool_name}()</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-400 block mb-1 font-bold text-[9px]">ARGUMENTS (JSON)</span>
                  <pre className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700 overflow-x-auto text-[10px] font-mono leading-relaxed">
                    {JSON.stringify(selectedRequest.arguments, null, 2)}
                  </pre>
                </div>
                <div className="pt-2">
                  <span className="text-slate-400 block mb-0.5 font-bold text-[9px]">RISK ANALYSIS</span>
                  <p className="text-slate-600 font-sans leading-relaxed text-xs">{selectedRequest.risk_explanation || "No explanation provided."}</p>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-[9px]">ENVIRONMENT</span>
                  <span className="text-slate-700 uppercase font-bold text-[10px]">{selectedRequest.environment}</span>
                </div>
                {selectedRequest.reason && (
                  <div className="pt-2">
                    <span className="text-slate-400 block mb-0.5 font-bold text-[9px]">DECISION NOTES</span>
                    <p className="text-slate-600 font-sans leading-relaxed text-xs">{selectedRequest.reason}</p>
                  </div>
                )}
              </div>

              {selectedRequest.status === "PENDING" && (
                <div className="flex flex-col gap-2 mt-2">
                  <textarea
                    placeholder="Provide justification notes (optional)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition h-16 resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleDecision(selectedRequest.id, "REJECTED")}
                      disabled={actionLoading}
                      className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleDecision(selectedRequest.id, "APPROVED")}
                      disabled={actionLoading}
                      className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
                    >
                      Authorize
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-slate-400 text-xs font-mono shadow-sm">
              Select a ticket from the queue to inspect and authorize.
            </div>
          )}
        </div>
      </div>

      {/* Terminal Live logs Modal */}
      {activeExecutionId && (
        <TerminalConsole
          executionId={activeExecutionId}
          onClose={() => setActiveExecutionId(null)}
        />
      )}
    </div>
  );
}
