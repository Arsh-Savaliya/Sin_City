import { html } from "../../lib/html.js";
import { Icons } from "./icons.js";

const navItems = [
  { key: "networks", label: "Networks", icon: Icons.network },
  { key: "crime-records", label: "Crime Records", icon: Icons.records },
  { key: "messages", label: "AI Feed", icon: Icons.message },
  { key: "user-details", label: "User Details", icon: Icons.user }
];

export function Sidebar({ currentPage, onNavigate, userProfile, onLogout, isOpen, onToggle }) {
  return html`
    <aside
      className=${`border-r border-white/10 bg-white/5 transition-all duration-300 ${
        isOpen ? "w-72 min-h-screen p-4 opacity-100" : "w-0 min-h-screen p-0 opacity-0 overflow-hidden border-r-0"
      } flex flex-col`}
      aria-hidden=${isOpen ? "false" : "true"}
    >
        <div className="mb-8">
          <div>
            <p className="font-display text-3xl uppercase tracking-[0.18em] text-blood">VELVET n VICE</p>
            <p className="text-xs uppercase tracking-widest text-white/50 mt-1">Intelligence Unit</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          ${navItems.map((item) => html`
            <button
              key=${item.key}
              type="button"
              onClick=${() => onNavigate(item.key)}
              className=${`w-full text-left px-4 py-3 rounded uppercase text-sm tracking-wider flex items-center gap-3 ${
                currentPage === item.key
                  ? "bg-blood/20 text-blood border border-blood/30"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-blood"><${item.icon} /></span>
              <span>${item.label}</span>
            </button>
          `)}
        </nav>

        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-blood/30 flex items-center justify-center text-white font-bold">
              ${(userProfile?.operatorName || userProfile?.username || "OP").slice(0,2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">${userProfile?.operatorName || userProfile?.username || "Operator"}</p>
              <p className="text-xs text-white/50 uppercase">${userProfile?.title || userProfile?.role || "Operator"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick=${onLogout}
            className="w-full text-left px-4 py-2 rounded text-xs uppercase tracking-wider text-white/50 hover:text-blood transition"
          >
            Logout
          </button>
        </div>
    </aside>
  `;
}
