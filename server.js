require("dotenv").config();

const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { Server } = require("socket.io");

const {
  connectDB,
  asyncHandler,
  listPeople, createPerson, updatePerson, deletePerson,
  listCrimes, createCrime, updateCrime,
  listRelationships, createRelationship, updateRelationship, deleteRelationship,
  getDashboardGraph,
  runRelationshipAnalysis,
  createEvent,
  listEvents,
  runSimulationTick,
  startSimulation,
  setSimulationRunning,
  getSimulationState,
  emitGraphRefresh
} = require("./src/services");

const seedDatabase = require("./src/seed");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.set("io", io);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  const wrap = (fn) => asyncHandler(fn(req, res, next));
  req.handle = wrap;
  next();
});

const peopleRouter = express.Router();
peopleRouter.get("/", asyncHandler(async (req, res) => {
  const people = await listPeople(req.query);
  res.json(people);
}));
peopleRouter.post("/", asyncHandler(async (req, res) => {
  const person = await createPerson(req.body);
  emitGraphRefresh(req.app.get("io"), "person:create");
  res.status(201).json(person);
}));
peopleRouter.patch("/:id", asyncHandler(async (req, res) => {
  const person = await updatePerson(req.params.id, req.body);
  emitGraphRefresh(req.app.get("io"), "person:update");
  res.json(person);
}));
peopleRouter.delete("/:id", asyncHandler(async (req, res) => {
  const person = await deletePerson(req.params.id);
  emitGraphRefresh(req.app.get("io"), "person:delete");
  res.json(person);
}));

const crimeRouter = express.Router();
crimeRouter.get("/", asyncHandler(async (_req, res) => {
  const crimes = await listCrimes();
  res.json(crimes);
}));
crimeRouter.post("/", asyncHandler(async (req, res) => {
  const crime = await createCrime(req.body);
  emitGraphRefresh(req.app.get("io"), "crime:create");
  res.status(201).json(crime);
}));
crimeRouter.patch("/:id", asyncHandler(async (req, res) => {
  const crime = await updateCrime(req.params.id, req.body);
  emitGraphRefresh(req.app.get("io"), "crime:update");
  res.json(crime);
}));

const relationshipRouter = express.Router();
relationshipRouter.get("/", asyncHandler(async (_req, res) => {
  const data = await listRelationships();
  res.json(data);
}));
relationshipRouter.post("/", asyncHandler(async (req, res) => {
  const relationship = await createRelationship(req.body);
  emitGraphRefresh(req.app.get("io"), "relationship:create");
  res.status(201).json(relationship);
}));
relationshipRouter.patch("/:id", asyncHandler(async (req, res) => {
  const relationship = await updateRelationship(req.params.id, req.body);
  emitGraphRefresh(req.app.get("io"), "relationship:update");
  res.json(relationship);
}));
relationshipRouter.delete("/:id", asyncHandler(async (req, res) => {
  const relationship = await deleteRelationship(req.params.id);
  emitGraphRefresh(req.app.get("io"), "relationship:delete");
  res.json(relationship);
}));

const dashboardRouter = express.Router();
dashboardRouter.get("/graph", asyncHandler(async (_req, res) => {
  const graph = await getDashboardGraph();
  res.json(graph);
}));
dashboardRouter.get("/analytics", asyncHandler(async (_req, res) => {
  const analytics = await runRelationshipAnalysis();
  res.json(analytics);
}));
dashboardRouter.get("/events", asyncHandler(async (_req, res) => {
  const events = await listEvents();
  res.json(events);
}));
dashboardRouter.get("/simulation", asyncHandler(async (_req, res) => {
  res.json(await getSimulationState());
}));
dashboardRouter.post("/simulation/toggle", asyncHandler(async (req, res) => {
  const state = setSimulationRunning(req.body.isRunning);
  emitGraphRefresh(req.app.get("io"), state.isRunning ? "simulation-resumed" : "simulation-paused");
  res.json(await getSimulationState());
}));
dashboardRouter.post("/simulation/tick", asyncHandler(async (req, res) => {
  const result = await runSimulationTick(req.body.reason || "manual");
  await emitGraphRefresh(req.app.get("io"), "simulation-tick");
  res.json(result);
}));

const { Person } = require("./src/models");
dashboardRouter.post("/characters/:id/promote", asyncHandler(async (req, res) => {
  const person = await Person.findById(req.params.id);
  if (!person) {
    const error = new Error("Character not found");
    error.status = 404;
    throw error;
  }
  person.powerLevel = Math.min(1000, person.powerLevel + 120);
  person.influenceScore = Math.min(100, person.influenceScore + 10);
  person.loyaltyScore = Math.min(100, person.loyaltyScore + 6);
  await person.save();
  await createEvent({
    type: "promotion",
    headline: `${person.name} was promoted`,
    summary: `${person.name} received a user-forced promotion and surged upward in the power map.`,
    actor: person._id,
    faction: person.faction
  });
  await emitGraphRefresh(req.app.get("io"), "promotion");
  res.json(person);
}));
dashboardRouter.post("/characters/:id/eliminate", asyncHandler(async (req, res) => {
  const person = await Person.findById(req.params.id);
  if (!person) {
    const error = new Error("Character not found");
    error.status = 404;
    throw error;
  }
  person.status = "dead";
  person.powerLevel = 0;
  await person.save();
  await createEvent({
    type: "elimination",
    headline: `${person.name} was eliminated`,
    summary: `${person.name} was removed by direct user action, forcing the network to adapt immediately.`,
    actor: person._id,
    target: person._id,
    faction: person.faction
  });
  await emitGraphRefresh(req.app.get("io"), "elimination");
  res.json(person);
}));

app.use("/api/people", peopleRouter);
app.use("/api/relationships", relationshipRouter);
app.use("/api/crimes", crimeRouter);
app.use("/api/dashboard", dashboardRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sin-city-network", timestamp: new Date().toISOString() });
});

app.get(/^\/(?!api(?:\/|$)|health$).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;

function registerSocketHandlers(socketIo) {
  socketIo.on("connection", (socket) => {
    socket.on("simulation:toggle", async (data) => {
      setSimulationRunning(data.isRunning);
      const state = await getSimulationState();
      socketIo.emit("simulation:state", state);
    });
    socket.on("simulation:tick", async (reason) => {
      const result = await runSimulationTick(reason || "socket");
      socketIo.emit("graph:refresh", { reason: "socket-tick", result, timestamp: new Date() });
    });
  });
}

async function bootstrap() {
  await connectDB(process.env.MONGODB_URI);
  await seedDatabase();

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