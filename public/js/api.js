const headers = {
  "Content-Type": "application/json"
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers,
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}

export const api = {
  getDashboard: () => request("/api/dashboard/graph"),
  getAnalytics: () => request("/api/dashboard/analytics"),
  getEvents: () => request("/api/dashboard/events"),
  getSimulationState: () => request("/api/dashboard/simulation"),
  getPeople: () => request("/api/people"),
  getCrimes: () => request("/api/crimes"),
  updatePersonStatus: (id, status) =>
    request(`/api/people/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),
  createCrime: (payload) =>
    request("/api/crimes", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateCrime: (id, payload) =>
    request(`/api/crimes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  toggleSimulation: (isRunning) =>
    request("/api/dashboard/simulation/toggle", {
      method: "POST",
      body: JSON.stringify({ isRunning })
    }),
  runSimulationTick: (reason = "manual") =>
    request("/api/dashboard/simulation/tick", {
      method: "POST",
      body: JSON.stringify({ reason })
    }),
  promoteCharacter: (id) =>
    request(`/api/dashboard/characters/${id}/promote`, {
      method: "POST"
    }),
  eliminateCharacter: (id) =>
    request(`/api/dashboard/characters/${id}/eliminate`, {
      method: "POST"
    })
};
