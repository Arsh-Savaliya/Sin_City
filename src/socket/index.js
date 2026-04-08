const { getDashboardGraph } = require("../services/graphService");
const { runRelationshipAnalysis } = require("../services/analyticsService");

function registerSocketHandlers(io) {
  io.on("connection", async (socket) => {
    socket.emit("system:ready", {
      connectedAt: new Date().toISOString()
    });

    socket.on("dashboard:refresh", async () => {
      try {
        const [graph, analytics] = await Promise.all([getDashboardGraph(), runRelationshipAnalysis()]);
        socket.emit("graph:refresh", { graph, analytics, reason: "manual" });
      } catch (error) {
        socket.emit("system:error", { message: error.message });
      }
    });
  });
}

async function emitGraphRefresh(io, reason = "update") {
  if (!io) {
    return;
  }
  try {
    const [graph, analytics] = await Promise.all([getDashboardGraph(), runRelationshipAnalysis()]);
    io.emit("graph:refresh", { graph, analytics, reason });
  } catch (error) {
    console.error("Realtime refresh failed", error);
  }
}

module.exports = {
  registerSocketHandlers,
  emitGraphRefresh
};
