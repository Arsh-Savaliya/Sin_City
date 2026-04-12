function authHeaders(token) {
  return token ? { 
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  } : { "Content-Type": "application/json" };
}

async function request(path, options = {}, token) {
  const response = await fetch(path, {
    headers: authHeaders(token),
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}

export const api = {
  getCurrentUser: (token) => request("/api/auth/me", {}, token),
  updateCurrentUser: (payload, token) =>
    request("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload)
    }, token),
  getDashboard: (token) => request("/api/dashboard/graph", {}, token),
  getAnalytics: (token) => request("/api/dashboard/analytics", {}, token),
  getSimulation: (token) => request("/api/dashboard/simulation", {}, token),
  guessCulprit: (suspectId, token) =>
    request("/api/dashboard/culprit/guess", {
      method: "POST",
      body: JSON.stringify({ suspectId })
    }, token),
  
  updatePersonStatus: (id, status, token) =>
    request(`/api/people/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }, token),
    
  createCrime: (payload, token) =>
    request("/api/crimes", {
      method: "POST",
      body: JSON.stringify(payload)
    }, token),
    
  updateCrime: (id, payload, token) =>
    request(`/api/crimes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }, token),
    
  toggleSimulation: (isRunning, token) =>
    request("/api/dashboard/simulation/toggle", {
      method: "POST",
      body: JSON.stringify({ isRunning })
    }, token),
    
  runSimulationTick: (reason = "manual-ui", token) =>
    request("/api/dashboard/simulation/tick", {
      method: "POST",
      body: JSON.stringify({ reason })
    }, token),
    
  promoteCharacter: (id, token) =>
    request(`/api/dashboard/characters/${id}/promote`, {
      method: "POST"
    }, token),
    
  eliminateCharacter: (id, token) =>
    request(`/api/dashboard/characters/${id}/eliminate`, {
      method: "POST"
    }, token)
};
