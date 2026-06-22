"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("admin@safeops.io");
  const [password, setPassword] = useState("safeops-admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Set document title dynamically
    document.title = "SafeOps MCP — Systems Governance Control Panel";
    
    // Read token from localStorage
    const savedToken = localStorage.getItem("safeops_token");
    if (savedToken) {
      setToken(savedToken);
    }
    setInitialized(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Authentication failed");
      }

      const data = await response.json();
      localStorage.setItem("safeops_token", data.access_token);
      setToken(data.access_token);
    } catch (err: any) {
      setError(err.message || "Connection refused by SafeOps backend");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("safeops_token");
    setToken(null);
    setError(null);
  };

  if (!initialized) {
    return (
      <html lang="en">
        <body className="bg-slate-50 min-h-screen flex items-center justify-center">
          <div className="text-slate-500 font-mono text-xs">Initializing dashboard session...</div>
        </body>
      </html>
    );
  }

  // Render Login Card if unauthenticated
  if (!token) {
    return (
      <html lang="en">
        <body className="bg-slate-50 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-slate-900 p-8 text-white flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="font-mono tracking-widest text-lg font-bold">SAFEOPS</span>
                <span className="text-[10px] uppercase bg-indigo-900 border border-indigo-700 text-indigo-300 font-sans font-semibold px-1 rounded">MCP</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight mt-3">Administrative Control Login</h2>
              <p className="text-slate-400 text-xs">Verify credentials to audit and approve AI agent infrastructure modifications.</p>
            </div>

            <form onSubmit={handleLogin} className="p-8 flex flex-col gap-5">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Email Address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow transition disabled:opacity-50"
              >
                {loading ? "Authenticating session..." : "Authenticate Session"}
              </button>

              <div className="text-[10px] text-slate-500 font-mono text-center mt-2 border-t border-slate-100 pt-4">
                Seeded user: admin@safeops.io / safeops-admin
              </div>
            </form>
          </div>
        </body>
      </html>
    );
  }

  const navItems = [
    {
      href: "/",
      label: "Overview",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
    {
      href: "/approvals",
      label: "Approvals Queue",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      href: "/tools",
      label: "Tools Catalog",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
    },
    {
      href: "/audit",
      label: "Audit Ledger",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: "/policies",
      label: "Policies Editor",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      href: "/agents",
      label: "Connected Agents",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      href: "/rollbacks",
      label: "Rollback Center",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.235" />
        </svg>
      ),
    },
  ];

  return (
    <html lang="en">
      <body className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
        
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0">
          <div>
            {/* Sidebar Brand Logo */}
            <div className="h-16 border-b border-slate-200 flex items-center px-6 gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <span className="tracking-widest text-base font-bold text-slate-800 flex items-center gap-1.5">
                SAFEOPS
                <span className="text-[9px] uppercase font-sans font-semibold bg-indigo-50 border border-indigo-100 text-indigo-600 px-1 rounded">MCP</span>
              </span>
            </div>
            
            {/* Sidebar Nav Items */}
            <nav className="p-4 flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs font-semibold rounded-xl transition ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-100/50"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                  >
                    <span className={isActive ? "text-indigo-600" : "text-slate-400"}>
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
          
          {/* Sidebar Footer Widget */}
          <div className="p-4 border-t border-slate-200 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 border border-slate-200">
                OP
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">System Operator</span>
                <span className="text-[10px] text-slate-400 font-mono">admin@safeops.io</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out Session
            </button>
          </div>
        </aside>
        
        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Main Top Header Bar */}
          <header className="h-16 border-b border-slate-200 px-8 flex items-center justify-between bg-white shrink-0">
            <div className="font-mono text-[10px] tracking-wider font-bold text-slate-400 uppercase">
              Control Panel Console
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Sandbox: ONLINE
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Host IP: 127.0.0.1</span>
            </div>
          </header>
          
          {/* Main Body */}
          <section className="flex-1 overflow-y-auto p-8">
            {children}
          </section>
        </main>
        
      </body>
    </html>
  );
}
