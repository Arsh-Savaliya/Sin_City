import { React, html } from "../lib/html.js";
import { Panel, PageIntro, Badge } from "../components/sections/common.js";
import { formatTime } from "../utils/dashboard.js";

const { useEffect, useState } = React;

export function CrimeRecordsPage({ dashboard, actions }) {
  const criminals = (dashboard?.people || []).filter((person) => person.role === "criminal");
  const police = (dashboard?.people || []).filter((person) => person.role === "police");
  const crimes = dashboard?.crimes || [];

  const [crimeForm, setCrimeForm] = useState({
    crimeId: "",
    title: "",
    category: "",
    district: "",
    occurredAt: "",
    evidence: "",
    summary: "",
    status: "open",
    committedBy: [],
    solvedBy: ""
  });
  const [statusForm, setStatusForm] = useState({
    id: "",
    status: "open",
    solvedBy: ""
  });

  useEffect(() => {
    if (!crimes.length) {
      return;
    }
    setStatusForm((current) =>
      current.id
        ? current
        : {
            id: crimes[0]._id,
            status: crimes[0].status || "open",
            solvedBy: crimes[0].solvedBy?._id || ""
          }
    );
  }, [crimes]);

  async function handleCreateCrime(event) {
    event.preventDefault();
    try {
      await actions.createCrime({
        ...crimeForm,
        solvedBy: crimeForm.solvedBy || undefined
      });
      setCrimeForm({
        crimeId: "",
        title: "",
        category: "",
        district: "",
        occurredAt: "",
        evidence: "",
        summary: "",
        status: "open",
        committedBy: [],
        solvedBy: ""
      });
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function handleUpdateCrime(event) {
    event.preventDefault();
    if (!statusForm.id) {
      return;
    }
    try {
      await actions.updateCrime(statusForm.id, {
        status: statusForm.status,
        solvedBy: statusForm.solvedBy || null
      });
    } catch (error) {
      window.alert(error.message);
    }
  }

  return html`
    <div className="space-y-8">
      <${PageIntro}
        title="Crime Record System"
        subtitle="Create, update, and monitor case files tied directly to the living network."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <${Panel} eyebrow="Case Creation" title="Add Crime Record">
          <form className="space-y-4" onSubmit=${handleCreateCrime}>
            <div className="grid gap-4 sm:grid-cols-2">
              ${textInput("Crime ID", crimeForm.crimeId, (value) => setCrimeForm({ ...crimeForm, crimeId: value }))}
              ${textInput("Crime Title", crimeForm.title, (value) => setCrimeForm({ ...crimeForm, title: value }))}
              ${textInput("Category", crimeForm.category, (value) => setCrimeForm({ ...crimeForm, category: value }))}
              ${textInput("District", crimeForm.district, (value) => setCrimeForm({ ...crimeForm, district: value }))}
              ${dateInput("Occurred At", crimeForm.occurredAt, (value) => setCrimeForm({ ...crimeForm, occurredAt: value }))}
              ${textInput("Evidence", crimeForm.evidence, (value) => setCrimeForm({ ...crimeForm, evidence: value }))}
            </div>

            <label className="input-shell">
              <span>Summary</span>
              <textarea
                value=${crimeForm.summary}
                onChange=${(event) => setCrimeForm({ ...crimeForm, summary: event.target.value })}
                rows="4"
                className="input-element min-h-[120px]"
                required
              ></textarea>
            </label>

            <label className="input-shell">
              <span>Committed By</span>
              <select
                multiple
                value=${crimeForm.committedBy}
                onChange=${(event) =>
                  setCrimeForm({
                    ...crimeForm,
                    committedBy: Array.from(event.target.selectedOptions).map((option) => option.value)
                  })}
                className="input-element min-h-[140px]"
                required
              >
                ${criminals.map(
                  (person) => html`<option key=${person._id} value=${person._id}>${person.name}</option>`
                )}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-shell">
                <span>Status</span>
                <select
                  value=${crimeForm.status}
                  onChange=${(event) => setCrimeForm({ ...crimeForm, status: event.target.value })}
                  className="input-element"
                >
                  ${["open", "investigating", "solved", "cold"].map(
                    (value) => html`<option key=${value} value=${value}>${value}</option>`
                  )}
                </select>
              </label>

              <label className="input-shell">
                <span>Solved By</span>
                <select
                  value=${crimeForm.solvedBy}
                  onChange=${(event) => setCrimeForm({ ...crimeForm, solvedBy: event.target.value })}
                  className="input-element"
                >
                  <option value="">Unsolved</option>
                  ${police.map(
                    (person) => html`<option key=${person._id} value=${person._id}>${person.name}</option>`
                  )}
                </select>
              </label>
            </div>

            <button type="submit" className="action-pill">Create Record</button>
          </form>
        </${Panel}>

        <${Panel} eyebrow="Case Status" title="Update Existing Record">
          <form className="space-y-4" onSubmit=${handleUpdateCrime}>
            <label className="input-shell">
              <span>Crime Record</span>
              <select
                value=${statusForm.id}
                onChange=${(event) => {
                  const crime = crimes.find((entry) => entry._id === event.target.value);
                  setStatusForm({
                    id: event.target.value,
                    status: crime?.status || "open",
                    solvedBy: crime?.solvedBy?._id || ""
                  });
                }}
                className="input-element"
              >
                ${crimes.map(
                  (crime) => html`<option key=${crime._id} value=${crime._id}>${crime.crimeId} / ${crime.title}</option>`
                )}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-shell">
                <span>Status</span>
                <select
                  value=${statusForm.status}
                  onChange=${(event) => setStatusForm({ ...statusForm, status: event.target.value })}
                  className="input-element"
                >
                  ${["open", "investigating", "solved", "cold"].map(
                    (value) => html`<option key=${value} value=${value}>${value}</option>`
                  )}
                </select>
              </label>

              <label className="input-shell">
                <span>Solved By</span>
                <select
                  value=${statusForm.solvedBy}
                  onChange=${(event) => setStatusForm({ ...statusForm, solvedBy: event.target.value })}
                  className="input-element"
                >
                  <option value="">No Officer</option>
                  ${police.map(
                    (person) => html`<option key=${person._id} value=${person._id}>${person.name}</option>`
                  )}
                </select>
              </label>
            </div>

            <button type="submit" className="action-pill secondary">Update Record</button>
          </form>

          <div className="mt-6 max-h-[420px] space-y-3 overflow-y-auto pr-2">
            ${crimes.map(
              (crime) => html`
                <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white">${crime.crimeId}</p>
                      <p className="mt-1 text-lg font-semibold text-white">${crime.title}</p>
                    </div>
                    <${Badge} tone=${crime.status === "solved" ? "medium" : crime.status === "cold" ? "low" : "high"}>
                      ${crime.status}
                    </${Badge}>
                  </div>
                  <p className="mt-2 text-sm text-white/58">${crime.summary}</p>
                  <div className="mt-3 grid gap-2 text-sm text-white/52">
                    <p>Category: ${crime.category}</p>
                    <p>District: ${crime.district || "Unknown"}</p>
                    <p>Occurred: ${formatTime(crime.occurredAt)}</p>
                    <p>Committed By: ${(crime.committedBy || []).map((entry) => entry.name).join(", ") || "Unknown"}</p>
                    <p>Solved By: ${crime.solvedBy?.name || "Unassigned"}</p>
                  </div>
                </article>
              `
            )}
          </div>
        </${Panel}>
      </div>
    </div>
  `;
}

function textInput(label, value, onChange) {
  return html`
    <label className="input-shell">
      <span>${label}</span>
      <input
        value=${value}
        onChange=${(event) => onChange(event.target.value)}
        className="input-element"
        required
      />
    </label>
  `;
}

function dateInput(label, value, onChange) {
  return html`
    <label className="input-shell">
      <span>${label}</span>
      <input
        type="datetime-local"
        value=${value}
        onChange=${(event) => onChange(event.target.value)}
        className="input-element"
        required
      />
    </label>
  `;
}
