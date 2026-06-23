"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

interface TerminalConsoleProps {
  executionId: string;
  onClose: () => void;
}

export default function TerminalConsole({ executionId, onClose }: TerminalConsoleProps) {
  const [logs, setLogs] = useState<string>("");
  const [status, setStatus] = useState<string>("PENDING");
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let intervalId: any;
    const token = localStorage.getItem("safeops_token");

    const fetchLogs = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/executions/${executionId}/live-logs`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setLogs(data.logs || "");
          setStatus(data.status || "PENDING");
          
          // Stop polling if execution finishes
          if (data.status === "COMPLETED" || data.status === "FAILED" || data.status === "REJECTED") {
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        console.error("Error fetching live logs:", err);
      }
    };

    fetchLogs();
    intervalId = setInterval(fetchLogs, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [executionId]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[480px]"
      >
        {/* Terminal Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            </div>
            <span className="font-mono text-xs font-bold text-slate-700">Sandbox Console Output</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
              status === "EXECUTING" ? "bg-amber-50 text-amber-600 border border-amber-100 animate-pulse" :
              status === "COMPLETED" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
              status === "FAILED" ? "bg-rose-50 text-rose-600 border border-rose-100" :
              "bg-slate-100 text-slate-500 border border-slate-200"
            }`}>
              {status}
            </span>
          </div>
          
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-xs font-bold px-2.5 py-1 hover:bg-slate-200/50 rounded-lg transition"
          >
            Close
          </button>
        </div>

        {/* Terminal Screen */}
        <div className="flex-1 bg-slate-950 p-5 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 flex flex-col gap-1">
          {logs ? (
            <pre className="whitespace-pre-wrap font-mono">{logs}</pre>
          ) : (
            <div className="text-slate-500 italic">Waiting for connection...</div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </motion.div>
    </div>
  );
}
