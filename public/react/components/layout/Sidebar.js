import { html, motion } from "../../lib/html.js";
import { Icons } from "./icons.js";

const { NavLink } = window.ReactRouterDOM;
const navItems = [
  { to: "/networks", label: "Networks", icon: Icons.network },
  { to: "/pressure-map", label: "Pressure Map", icon: Icons.heat },
  { to: "/unstable-hierarchies", label: "Unstable Hierarchies", icon: Icons.hierarchy },
  { to: "/crime-records", label: "Crime Record System", icon: Icons.records },
  { to: "/messages", label: "Messages", icon: Icons.message },
  { to: "/user-details", label: "User Details", icon: Icons.user }
];

export function Sidebar({ collapsed, mobileOpen, setCollapsed, setMobileOpen, userProfile }) {
  return html`
    <${motion.aside}
      initial=${false}
      animate=${{
        width: collapsed ? 92 : 280,
        x: mobileOpen ? 0 : 0
      }}
      transition=${{ type: "spring", stiffness: 210, damping: 24 }}
      className=${`sidebar-shell ${mobileOpen ? "is-mobile-open" : ""}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
        <div className=${collapsed ? "hidden" : "block"}>
          <p className="font-display text-5xl uppercase tracking-[0.08em] text-blood">Sincity</p>
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-white/45">Truth lies in the shadows</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="sidebar-toggle hidden lg:inline-flex"
            onClick=${() => setCollapsed(!collapsed)}
            aria-label=${collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            ${collapsed ? Icons.expand() : Icons.collapse()}
          </button>
          <button
            type="button"
            className="sidebar-toggle lg:hidden"
            onClick=${() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            ${Icons.collapse()}
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        ${navItems.map(
          (item) => html`
            <${NavLink}
              to=${item.to}
              onClick=${() => setMobileOpen(false)}
              className=${({ isActive }) =>
                `sidebar-link ${isActive ? "is-active" : ""} ${collapsed ? "is-collapsed" : ""}`}
            >
              <span className="sidebar-icon">${item.icon()}</span>
              ${!collapsed && html`<span>${item.label}</span>`}
            </${NavLink}>
          `
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-5">
        <div className=${`rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 ${collapsed ? "text-center" : ""}`}>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-blood/30 bg-blood/[0.16] text-lg font-bold text-white">
            ${(userProfile?.name || "JM")
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
          ${!collapsed &&
          html`
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">${userProfile?.name || "J. Marlowe"}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">${userProfile?.role || "Field Analyst"}</p>
          `}
        </div>
      </div>
    </${motion.aside}>
  `;
}
