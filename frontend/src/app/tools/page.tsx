"use client";

import React, { useState } from "react";

// Mock tools list reflecting the backend defaults
const INITIAL_TOOLS = [
  { name: "get_uptime", category: "system", description: "Gets host machine system uptime.", risk: 1.0, rollback: "None" },
  { name: "cpu_usage", category: "system", description: "Gets real-time CPU utilization metrics.", risk: 1.0, rollback: "None" },
  { name: "ram_usage", category: "system", description: "Gets memory utilization metrics.", risk: 1.0, rollback: "None" },
  { name: "disk_usage", category: "system", description: "Gets partition and storage usage details.", risk: 1.0, rollback: "None" },
  { name: "system_health", category: "system", description: "Combined diagnostic checks (load average, memory, disk).", risk: 1.0, rollback: "None" },
  { name: "check_updates", category: "packages", description: "Queries available package repository updates.", risk: 2.0, rollback: "None" },
  { name: "update_package", category: "packages", description: "Upgrades or installs a specific package on the system.", risk: 5.0, rollback: "Directory snapshot / Package rollback" },
  { name: "remove_package", category: "packages", description: "Uninstalls a specific package from the host.", risk: 7.0, rollback: "Directory snapshot / Package rollback" },
  { name: "start_service", category: "services", description: "Starts a targeted systemd or docker service.", risk: 4.0, rollback: "Service status stop command" },
  { name: "stop_service", category: "services", description: "Stops a targeted systemd or docker service.", risk: 6.0, rollback: "Service status start command" },
  { name: "restart_service", category: "services", description: "Restarts a targeted systemd or docker service.", risk: 5.0, rollback: "Service status status checker" },
  { name: "service_status", category: "services", description: "Returns running state properties of a service.", risk: 1.0, rollback: "None" },
  { name: "traverse_documentation", category: "setup", description: "Safely reads and converts online guides to markdown format.", risk: 2.0, rollback: "None" },
  { name: "simulate_install", category: "setup", description: "Runs installation script dry-runs inside an isolated Docker sandbox.", risk: 4.0, rollback: "Directory snapshot revert hook" }
];

export default function ToolsCatalogPage() {
  const [tools] = useState(INITIAL_TOOLS);
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const filteredTools = categoryFilter === "ALL" 
    ? tools 
    : tools.filter((t) => t.category === categoryFilter);

  const categories = ["ALL", "system", "packages", "services", "setup"];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">MCP Tools Catalog</h2>
          <p className="text-zinc-400 text-sm mt-1">Browse the active registry of operational tools exposed to connecting AI clients.</p>
        </div>

        {/* Category Filters */}
        <div className="bg-[#18181b] border border-cyber-border rounded-lg p-1 flex gap-1 font-mono text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-md font-semibold transition uppercase ${
                categoryFilter === cat ? "bg-zinc-800 text-white border border-cyber-border" : "text-zinc-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool) => (
          <div key={tool.name} className="bg-cyber-card border border-cyber-border rounded-xl p-6 glow-card flex flex-col justify-between h-48">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-zinc-900 border border-cyber-border uppercase text-zinc-400">
                  {tool.category}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                  tool.risk < 3.0 ? "bg-cyber-emerald/10 text-cyber-emerald border border-cyber-emerald/20" :
                  tool.risk < 7.0 ? "bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/20" :
                  "bg-cyber-rose/10 text-cyber-rose border border-cyber-rose/20"
                }`}>
                  Risk: {tool.risk.toFixed(1)}
                </span>
              </div>
              
              <h3 className="text-sm font-bold font-mono text-white mt-4 flex items-center gap-1">
                <span className="text-cyber-cyan">{tool.name}</span>()
              </h3>
              
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed h-10 overflow-hidden line-clamp-2">
                {tool.description}
              </p>
            </div>

            <div className="border-t border-cyber-border/40 pt-3 mt-4 text-[10px] font-mono text-zinc-500 flex justify-between items-center">
              <span>ROLLBACK STRATEGY:</span>
              <span className={tool.rollback !== "None" ? "text-cyber-emerald" : "text-zinc-600"}>
                {tool.rollback.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
