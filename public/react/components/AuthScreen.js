import { React, html } from "../lib/html.js";
import { Icons } from "./layout/icons.js";

const { useState } = React;

export function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body = isLogin 
        ? { email, password } 
        : { username, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return html`
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <style>
        ${`
          @keyframes nocturne-login-runner {
            0% {
              transform: translateX(-18%) translateY(0) scale(0.92);
              opacity: 0;
            }
            8% {
              opacity: 1;
            }
            50% {
              transform: translateX(52%) translateY(-1px) scale(1);
              opacity: 1;
            }
            100% {
              transform: translateX(118%) translateY(0) scale(0.96);
              opacity: 0;
            }
          }

          @keyframes nocturne-login-trail {
            0% {
              opacity: 0;
              transform: scaleX(0.35);
            }
            20% {
              opacity: 0.9;
            }
            100% {
              opacity: 0.08;
              transform: scaleX(1.25);
            }
          }

          @keyframes nocturne-login-scan {
            0% {
              opacity: 0.18;
              transform: translateX(-6%);
            }
            50% {
              opacity: 0.35;
            }
            100% {
              opacity: 0.18;
              transform: translateX(6%);
            }
          }
        `}
      </style>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl uppercase tracking-[0.18em] text-blood">NOCTURNE</h1>
          <p className="text-white/50 mt-2 uppercase tracking-widest text-sm">Intelligence Unit</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="font-display text-2xl uppercase tracking-widest text-center mb-6">
            ${isLogin ? "Operator Login" : "New Recruit"}
          </h2>

          ${error && html`
            <div className="bg-blood/20 border border-blood/30 text-blood p-3 rounded mb-4 text-sm">
              ${error}
            </div>
          `}

          <form onSubmit=${handleSubmit} className="space-y-4">
            ${!isLogin && html`
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/50 mb-1">Username</label>
                <input
                  type="text"
                  value=${username}
                  onChange=${(e) => setUsername(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 px-4 py-3 rounded text-white placeholder-white/30 focus:border-blood focus:outline-none"
                  placeholder="Enter username"
                  required
                />
              </div>
            `}

            <div>
              <label className="block text-xs uppercase tracking-widest text-white/50 mb-1">Email</label>
              <input
                type="email"
                value=${email}
                onChange=${(e) => setEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/20 px-4 py-3 rounded text-white placeholder-white/30 focus:border-blood focus:outline-none"
                placeholder="Enter email"
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-white/50 mb-1">Password</label>
              <input
                type="password"
                value=${password}
                onChange=${(e) => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/20 px-4 py-3 rounded text-white placeholder-white/30 focus:border-blood focus:outline-none"
                placeholder="Enter password"
                required
                minlength="6"
              />
            </div>

            <button
              type="submit"
              disabled=${loading}
              className="w-full bg-blood hover:bg-blood/80 text-white font-display uppercase tracking-widest py-3 rounded transition disabled:opacity-50"
            >
              ${loading ? "Processing..." : isLogin ? "Enter" : "Register"}
            </button>

            ${loading && html`
              <div className="relative mt-4 overflow-hidden rounded-2xl border border-blood/20 bg-[radial-gradient(circle_at_20%_50%,rgba(196,30,58,0.18),transparent_38%),linear-gradient(90deg,rgba(255,255,255,0.02),rgba(196,30,58,0.06),rgba(255,255,255,0.02))] px-4 py-4">
                <div
                  className="pointer-events-none absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-blood/25 to-transparent"
                  style=${{ animation: "nocturne-login-scan 1.4s ease-in-out infinite alternate" }}
                ></div>
                <div className="relative h-14">
                  <div
                    className="absolute left-0 top-1/2 flex w-28 -translate-y-1/2 items-center"
                    style=${{ animation: "nocturne-login-runner 1.05s linear infinite" }}
                  >
                    <div
                      className="absolute right-6 h-3 w-20 origin-right rounded-full bg-gradient-to-r from-transparent via-blood/55 to-blood/12 blur-[5px]"
                      style=${{ animation: "nocturne-login-trail 1.05s linear infinite" }}
                    ></div>
                    <div className="absolute right-5 h-2 w-12 rounded-full bg-blood/35 blur-sm"></div>
                    <div className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-blood/20 bg-black/45 text-blood shadow-[0_0_22px_rgba(196,30,58,0.4)]">
                      <${Icons.triangle} className="h-5 w-5" />
                    </div>
                  </div>
                </div>
                <div className="relative mt-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.24em] text-white/45">
                  <span>Establishing link</span>
                  <span>Secure handoff</span>
                </div>
              </div>
            `}
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick=${() => { setIsLogin(!isLogin); setError(""); }}
              disabled=${loading}
              className="text-white/50 text-sm hover:text-blood transition"
            >
              ${isLogin ? "New operator? Register here" : "Already registered? Login here"}
            </button>
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-6 uppercase tracking-widest">
          Authorized Personnel Only
        </p>
      </div>
    </div>
  `;
}
