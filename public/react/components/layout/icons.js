import { html } from "../../lib/html.js";

function icon(paths) {
  return html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      ${paths}
    </svg>
  `;
}

export const Icons = {
  network: () =>
    icon(html`
      <circle cx="6" cy="6" r="2"></circle>
      <circle cx="18" cy="6" r="2"></circle>
      <circle cx="12" cy="18" r="2"></circle>
      <path d="M7.7 7.4l2.7 8"></path>
      <path d="M16.3 7.4l-2.7 8"></path>
      <path d="M8 6h8"></path>
    `),
  heat: () =>
    icon(html`
      <path d="M12 3c2.1 2.2 3.6 4.7 3.6 7.4A3.6 3.6 0 1 1 8.4 12c0-2.1 1.1-4.1 3.6-6.5"></path>
      <path d="M12 12c1.1 1 1.8 2 1.8 3.1a1.8 1.8 0 1 1-3.6 0c0-.7.4-1.6 1.8-3.1"></path>
    `),
  hierarchy: () =>
    icon(html`
      <rect x="10" y="3" width="4" height="4" rx="1"></rect>
      <rect x="3" y="17" width="4" height="4" rx="1"></rect>
      <rect x="17" y="17" width="4" height="4" rx="1"></rect>
      <path d="M12 7v5"></path>
      <path d="M5 17v-2h14v2"></path>
    `),
  records: () =>
    icon(html`
      <path d="M7 3h8l4 4v14H7z"></path>
      <path d="M15 3v4h4"></path>
      <path d="M10 13h6"></path>
      <path d="M10 17h4"></path>
    `),
  message: () =>
    icon(html`
      <path d="M4 6h16v12H8l-4 3z"></path>
      <path d="M8 10h8"></path>
      <path d="M8 14h6"></path>
    `),
  user: () =>
    icon(html`
      <circle cx="12" cy="8" r="3"></circle>
      <path d="M5 20c1.7-3.1 4.1-4.7 7-4.7S17.3 16.9 19 20"></path>
    `),
  search: () =>
    icon(html`
      <circle cx="11" cy="11" r="6"></circle>
      <path d="M20 20l-4.2-4.2"></path>
    `),
  menu: () =>
    icon(html`
      <path d="M4 7h16"></path>
      <path d="M4 12h16"></path>
      <path d="M4 17h16"></path>
    `),
  collapse: () =>
    icon(html`
      <path d="M15 6l-6 6 6 6"></path>
    `),
  expand: () =>
    icon(html`
      <path d="M9 6l6 6-6 6"></path>
    `),
  pulse: () =>
    icon(html`
      <path d="M3 12h4l2-5 4 10 2-5h6"></path>
    `)
};
