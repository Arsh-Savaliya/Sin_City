import { html } from "../../lib/html.js";

const navItems = [
  { key: "networks", label: "Networks" },
  { key: "pressure-map", label: "Pressure Map" },
  { key: "unstable-hierarchies", label: "Unstable Hierarchies" },
  { key: "crime-records", label: "Crime Records" },
  { key: "messages", label: "Messages" },
  { key: "user-details", label: "User Details" }
];

export function Sidebar({ currentPage, onNavigate, userProfile }) {
  return html`
    <aside className="w-64 bg-white/5 border-r border-white/10 min-h-screen p-4">
      <div className="mb-8">
        <p className="font-display text-4xl uppercase tracking-widest text-blood">Sin City</p>
        <p className="text-xs uppercase tracking-widest text-white/50 mt-1">Intelligence Unit</p>
      </div>

      <nav className="space-y-2">
        ${navItems.map((item) => html`
          <button
            key=${item.key}
            type="button"
            onClick=${() => onNavigate(item.key)}
            className=${`w-full text-left px-4 py-3 rounded uppercase text-sm tracking-wider ${
              currentPage === item.key
                ? "bg-blood/20 text-blood border border-blood/30"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            ${item.label}
          </button>
        `)}
      </nav>

      <div className="mt-8 pt-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-blood/30 flex items-center justify-center text-white font-bold">
            ${(userProfile?.name || "JM").split(" ").map(p => p[0]).join("").slice(0,2)}
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider">${userProfile?.name || "J. Marlowe"}</p>
            <p className="text-xs text-white/50 uppercase">${userProfile?.role || "Operator"}</p>
          </div>
        </div>
      </div>
    </aside>
  `;
}