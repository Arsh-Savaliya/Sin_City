import { html } from "../lib/html.js";
import { Panel, PageIntro, Badge } from "../components/sections/common.js";
import { formatTime } from "../utils/dashboard.js";

export function MessagesPage({ messages }) {
  return html`
    <div className="space-y-8">
      <${PageIntro}
        title="Messages"
        subtitle="Signal traffic, surveillance alerts, and event-engine dispatches collected in one noir feed."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_340px]">
        <${Panel} eyebrow="Live Feed" title="Incoming Intelligence">
          <div className="space-y-3">
            ${messages.map(
              (message) => html`
                <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-5 transition duration-300 hover:border-blood/25 hover:bg-blood/[0.05]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">${message.sender}</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">${message.subject}</h3>
                    </div>
                    <${Badge} tone=${message.priority === "high" ? "high" : message.priority === "medium" ? "medium" : "low"}>
                      ${message.priority}
                    </${Badge}>
                  </div>
                  <p className="mt-3 text-sm text-white/62">${message.body}</p>
                  <p className="mt-3 text-[0.68rem] uppercase tracking-[0.18em] text-white/32">${formatTime(message.timestamp)}</p>
                </article>
              `
            )}
          </div>
        </${Panel}>

        <div className="space-y-6">
          <${Panel} eyebrow="Message Rules" title="Inbox Logic">
            <div className="space-y-3 text-sm text-white/62">
              <p>High priority means imminent violence, a takeover attempt, or a corrupted officer link.</p>
              <p>Medium priority captures betrayal vectors, recruitment pushes, and instability spikes.</p>
              <p>Low priority holds ambient signals and background movement around the city.</p>
            </div>
          </${Panel}>

          <${Panel} eyebrow="Operator Guidance" title="Suggested Reading Order">
            <ol className="space-y-3 text-sm text-white/62">
              <li>1. Review high-priority dispatches for fresh bloodshed or corruption links.</li>
              <li>2. Cross-check medium alerts against the network graph and hidden relations.</li>
              <li>3. Use low-priority signals to anticipate the next outsider move.</li>
            </ol>
          </${Panel}>
        </div>
      </div>
    </div>
  `;
}
