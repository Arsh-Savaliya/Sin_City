require("dotenv").config();

const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { Server } = require("socket.io");

const connectDB = require("./src/config/db");
const createApiRouter = require("./src/routes");
const { registerSocketHandlers, emitGraphRefresh } = require("./src/socket");
const { seedDatabase } = require("./src/seed/seedData");
const {
  startSimulation,
  runSimulationTick,
  hydrateLoreProfiles
} = require("./src/services/simulationService");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.set("io", io);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", createApiRouter(io));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sin-city-network",
    timestamp: new Date().toISOString()
  });
});

app.get(/^\/(?!api(?:\/|$)|health$).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Server error"
  });
});

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await connectDB(process.env.MONGODB_URI);
  await seedDatabase();
  await hydrateLoreProfiles();

  registerSocketHandlers(io);
  startSimulation(async () => {
    await runSimulationTick("auto");
    await emitGraphRefresh(io, "simulation-auto");
  });

  server.listen(PORT, () => {
    console.log(`Sin City server running on http://localhost:${PORT}`);
    emitGraphRefresh(io, "bootstrap");
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start application", error);
  process.exit(1);
});
