import React from "react";
import "./globals.css";

export const metadata = {
  title: "SafeOps MCP — Cybersecurity Control Panel",
  description: "Secure governance and sandboxed command execution dashboard for AI agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen w-screen overflow-hidden bg-cyber-bg text-zinc-100">
        
        {/* Cybersecurity Side Navigation Bar */}
        <aside className="w-64 border-r border-cyber-border bg-[#0b0b0d] flex flex-col justify-between shrink-0">
          <div>
            {/* Header / Brand Identity */}
            <div className="h-16 border-b border-cyber-border flex items-center px-6 gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-cyber-cyan animate-pulse shadow-glow" />
              <span className="font-mono tracking-widest text-lg font-bold text-white">
                SAFEOPS <span className="text-cyber-cyan font-sans text-xs">MCP</span>
              </span>
            </div>
            
            {/* Nav Menu */}
            <nav className="p-4 flex flex-col gap-1.5">
              <a href="/" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition">
                <svg className="w-4 h-4 text-cyber-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
                </svg>
                Overview
              </a>
              <a href="/approvals" className="flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-cyber-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Approvals
                </div>
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-cyber-amber/15 text-cyber-amber rounded border border-cyber-amber/35">PENDING</span>
              </a>
              <a href="/tools" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition">
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Tools Catalog
              </a>
              <a href="/audit" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition">
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Audit Trail Logs
              </a>
              <a href="/policies" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition">
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Policies Editor
              </a>
              <a href="/agents" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition">
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Connected Agents
              </a>
              <a href="/rollbacks" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition">
                <svg className="w-4 h-4 text-cyber-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.235" />
                </svg>
                Rollback Center
              </a>
            </nav>
          </div>
          
          {/* Footer User Widget */}
          <div className="p-4 border-t border-cyber-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-cyber-cyan border border-cyber-cyan/20">
                OP
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">System Operator</span>
                <span className="text-[10px] text-zinc-400 font-mono">admin@safeops.io</span>
              </div>
            </div>
          </div>
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top Status Bar */}
          <header className="h-16 border-b border-cyber-border px-8 flex items-center justify-between bg-[#0b0b0d] shrink-0">
            <h1 className="text-sm font-mono tracking-wider font-semibold text-zinc-400 uppercase">
              // Control Panel Console
            </h1>
            <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyber-emerald shadow-successGlow animate-ping" />
                Secure Sandbox: ONLINE
              </span>
              <span className="text-zinc-600">|</span>
              <span>Host IP: 127.0.0.1</span>
            </div>
          </header>
          
          {/* Dashboard Children */}
          <section className="flex-1 overflow-y-auto p-8">
            {children}
          </section>
        </main>
        
      </body>
    </html>
  );
}
