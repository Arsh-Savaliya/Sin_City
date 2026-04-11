import { html } from "./lib/html.js";
import { App } from "./app.js";

const { createRoot } = window.ReactDOM;
const { BrowserRouter } = window.ReactRouterDOM;
const container = document.getElementById("root");

function renderBootError(message) {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:left;">
      <div style="max-width:760px;border:1px solid rgba(255,42,42,0.28);border-radius:24px;background:rgba(0,0,0,0.9);padding:28px 32px;box-shadow:0 24px 80px rgba(0,0,0,0.45);">
        <p style="margin:0;font-family:'Bebas Neue',sans-serif;font-size:48px;letter-spacing:0.14em;text-transform:uppercase;color:#ff2a2a;">Frontend Error</p>
        <p style="margin:10px 0 0;color:rgba(245,245,245,0.72);line-height:1.6;">${message}</p>
      </div>
    </div>
  `;
}

window.addEventListener("error", (event) => {
  if (event?.error?.message) {
    renderBootError(event.error.message);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason?.message || event?.reason || "Unknown startup error";
  renderBootError(String(reason));
});

try {
  const root = createRoot(container);
  root.render(html`<${BrowserRouter}><${App} /></${BrowserRouter}>`);
} catch (error) {
  renderBootError(error.message || "Failed to mount React application.");
}
