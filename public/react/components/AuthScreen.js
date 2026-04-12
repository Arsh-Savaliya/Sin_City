import { React, html } from "../lib/html.js";

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
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick=${() => { setIsLogin(!isLogin); setError(""); }}
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
