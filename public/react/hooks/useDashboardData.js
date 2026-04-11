import { React } from "../lib/html.js";
import { api } from "../api/client.js";
import { mockAnalytics, mockDashboard, mockSimulation } from "../data/mockData.js";

const { useCallback, useEffect, useMemo, useState } = React;

export function useDashboardData() {
  const [dashboard, setDashboard] = useState(mockDashboard);
  const [analytics, setAnalytics] = useState(mockAnalytics);
  const [simulation, setSimulation] = useState(mockSimulation);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingMockData, setUsingMockData] = useState(false);

  const loadAll = useCallback(async () => {
    setError("");

    try {
      const [dashboardData, analyticsData, simulationData] = await Promise.all([
        api.getDashboard(),
        api.getAnalytics(),
        api.getSimulation()
      ]);

      setDashboard(dashboardData || mockDashboard);
      setAnalytics(analyticsData || mockAnalytics);
      setSimulation(simulationData || mockSimulation);
      setUsingMockData(false);
    } catch (loadError) {
      console.error("Falling back to mock dashboard data", loadError);
      setDashboard(mockDashboard);
      setAnalytics(mockAnalytics);
      setSimulation(mockSimulation);
      setUsingMockData(true);
      setError(loadError.message || "Failed to load live dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (typeof window.io !== "function") {
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
  }, [loadAll]);

  const actions = useMemo(
    () => ({
      refresh: loadAll,
      async updatePersonStatus(id, status) {
        await api.updatePersonStatus(id, status);
        await loadAll();
      },
      async createCrime(payload) {
        await api.createCrime(payload);
        await loadAll();
      },
      async updateCrime(id, payload) {
        await api.updateCrime(id, payload);
        await loadAll();
      },
      async toggleSimulation(isRunning) {
        const nextState = await api.toggleSimulation(isRunning);
        setSimulation(nextState);
        await loadAll();
      },
      async runSimulationTick(reason) {
        await api.runSimulationTick(reason);
        await loadAll();
      },
      async promoteCharacter(id) {
        await api.promoteCharacter(id);
        await loadAll();
      },
      async eliminateCharacter(id) {
        await api.eliminateCharacter(id);
        await loadAll();
      }
    }),
    [loadAll]
  );

  return {
    dashboard,
    analytics,
    simulation,
    loading,
    error,
    usingMockData,
    actions
  };
}
