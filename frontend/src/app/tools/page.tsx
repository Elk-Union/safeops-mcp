"use client";

import React, { useState, useEffect } from "react";

export default function ToolsCatalogPage() {
  const [tools, setTools] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("safeops_token");
    if (!token) return;

    try {
      const response = await fetch("http://localhost:8000/api/v1/tools/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to retrieve tools catalog");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setTools(data);
      }
    } catch (err: any) {
      setError(err.message || "Could not retrieve tools catalog");
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("safeops_token");
    window.location.reload();
  };

  const categories = ["ALL", "system", "packages", "services", "setup"];

  const filteredTools = categoryFilter === "ALL" 
    ? tools 
    : tools.filter((t) => t.category === categoryFilter);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">MCP Tools Catalog</h2>
          <p className="text-slate-500 text-xs mt-1">Browse the active registry of operational tools exposed to connecting AI clients.</p>
        </div>

        {/* Category Filters */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-1 flex gap-1 font-mono text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition uppercase ${
                categoryFilter === cat 
                  ? "bg-white text-slate-900 border border-slate-200/50 shadow-sm" 
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs shadow-sm">
          Loading catalog actions registry...
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs shadow-sm">
          No tools registered in this category.
        </div>
      ) : (
        /* Tools Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => (
            <div key={tool.name} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-slate-300 transition shadow-sm hover:shadow flex flex-col justify-between h-48">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-slate-50 border border-slate-200 uppercase text-slate-400">
                    {tool.category}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    tool.base_risk < 3.0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                    tool.base_risk < 7.0 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                    "bg-rose-50 text-rose-700 border border-rose-100"
                  }`}>
                    Risk: {tool.base_risk.toFixed(1)}
                  </span>
                </div>
                
                <h3 className="text-sm font-bold font-mono text-slate-800 mt-4 flex items-center gap-1">
                  <span className="text-indigo-600">{tool.name}</span>()
                </h3>
                
                <p className="text-xs text-slate-500 mt-2 leading-relaxed h-10 overflow-hidden line-clamp-2">
                  {tool.description}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3 mt-4 text-[9px] font-mono text-slate-400 flex justify-between items-center">
                <span>ROLLBACK STRATEGY:</span>
                <span className={tool.rollback_available ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                  {tool.rollback_available ? "CHECKPOINT BACKUP" : "NONE"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
