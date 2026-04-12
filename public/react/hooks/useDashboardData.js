import { React } from "../lib/html.js";
import { api } from "../api/client.js";

const { useCallback, useEffect, useMemo, useState } = React;

export function useDashboardData(token) {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const [dashboardData, analyticsData, simulationData] = await Promise.all([
        api.getDashboard(token),
        api.getAnalytics(token),
        api.getSimulation(token)
      ]);

      setDashboard(dashboardData);
      setAnalytics(analyticsData);
      setSimulation(simulationData);
    } catch (loadError) {
      console.error("Failed to load dashboard data", loadError);
      setError(loadError.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!token || typeof window.io !== "function") {
      return undefined;
    }

    const socket = window.io();
    const handleRefresh = async () => {
      await loadAll();
    };

    socket.on("graph:refresh", handleRefresh);
    socket.on("system:error", (payload) => {
      setError(payload?.message || "System error");
    });

    socket.emit("dashboard:refresh");

    return () => {
      socket.off("graph:refresh", handleRefresh);
      socket.disconnect();
    };
  }, [token, loadAll]);

  const actions = useMemo(
    () => ({
      refresh: loadAll,
      async updatePersonStatus(id, status) {
        await api.updatePersonStatus(id, status, token);
        await loadAll();
      },
      async createCrime(payload) {
        await api.createCrime(payload, token);
        await loadAll();
      },
      async updateCrime(id, payload) {
        await api.updateCrime(id, payload, token);
        await loadAll();
      },
      async toggleSimulation(isRunning) {
        const nextState = await api.toggleSimulation(isRunning, token);
        setSimulation(nextState);
        await loadAll();
      },
      async runSimulationTick(reason) {
        await api.runSimulationTick(reason, token);
        await loadAll();
      },
      async promoteCharacter(id) {
        await api.promoteCharacter(id, token);
        await loadAll();
      },
      async eliminateCharacter(id) {
        await api.eliminateCharacter(id, token);
        await loadAll();
      }
    }),
    [loadAll, token]
  );

  return {
    dashboard,
    analytics,
    simulation,
    loading,
    error,
    actions
  };
}