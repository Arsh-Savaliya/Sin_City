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
  registerUser,
  loginUser,
  getCurrentUser,
  updateCurrentUser,
  authenticateToken,
  listPeople, createPerson, updatePerson, deletePerson,
  listCrimes, createCrime, updateCrime,
  listRelationships, createRelationship, updateRelationship, deleteRelationship,
  getDashboardGraph,
  runRelationshipAnalysis,
  createEvent,
  listEvents,
  runSimulationTick,
  guessCulprit,
  restartCulpritGame,
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

const userIdFromRequest = (req) => req.user?.userId;

// Auth routes (public)
const authRouter = express.Router();
authRouter.post("/register", asyncHandler(async (req, res) => {
  const result = await registerUser(req.body);
  res.status(201).json(result);
}));
authRouter.post("/login", asyncHandler(async (req, res) => {
  const result = await loginUser(req.body);
  res.json(result);
}));
authRouter.get("/me", authenticateToken, asyncHandler(async (req, res) => {
  res.json(await getCurrentUser(userIdFromRequest(req)));
}));
authRouter.patch("/me", authenticateToken, asyncHandler(async (req, res) => {
  res.json(await updateCurrentUser(userIdFromRequest(req), req.body));
}));

app.use("/api/auth", authRouter);

// Define routers first
const peopleRouter = express.Router();
const crimeRouter = express.Router();
const relationshipRouter = express.Router();
const dashboardRouter = express.Router();

// People routes
peopleRouter.get("/", asyncHandler(async (req, res) => {
  const people = await listPeople(userIdFromRequest(req), req.query);
  res.json(people);
}));
peopleRouter.post("/", asyncHandler(async (req, res) => {
  const person = await createPerson(userIdFromRequest(req), req.body);
  emitGraphRefresh(req.app.get("io"), "person:create");
  res.status(201).json(person);
}));
peopleRouter.patch("/:id", asyncHandler(async (req, res) => {
  const person = await updatePerson(userIdFromRequest(req), req.params.id, req.body);
  emitGraphRefresh(req.app.get("io"), "person:update");
  res.json(person);
}));
peopleRouter.delete("/:id", asyncHandler(async (req, res) => {
  const person = await deletePerson(userIdFromRequest(req), req.params.id);
  emitGraphRefresh(req.app.get("io"), "person:delete");
  res.json(person);
}));

// Crime routes
crimeRouter.get("/", asyncHandler(async (req, res) => {
  const crimes = await listCrimes(userIdFromRequest(req));
  res.json(crimes);
}));
crimeRouter.post("/", asyncHandler(async (req, res) => {
  const crime = await createCrime(userIdFromRequest(req), req.body);
  emitGraphRefresh(req.app.get("io"), "crime:create");
  res.status(201).json(crime);
}));
crimeRouter.patch("/:id", asyncHandler(async (req, res) => {
  const crime = await updateCrime(userIdFromRequest(req), req.params.id, req.body);
  emitGraphRefresh(req.app.get("io"), "crime:update");
  res.json(crime);
}));

// Relationship routes
relationshipRouter.get("/", asyncHandler(async (req, res) => {
  const data = await listRelationships(userIdFromRequest(req));
  res.json(data);
}));
relationshipRouter.post("/", asyncHandler(async (req, res) => {
  const relationship = await createRelationship(userIdFromRequest(req), req.body);
  emitGraphRefresh(req.app.get("io"), "relationship:create");
  res.status(201).json(relationship);
}));
relationshipRouter.patch("/:id", asyncHandler(async (req, res) => {
  const relationship = await updateRelationship(userIdFromRequest(req), req.params.id, req.body);
  emitGraphRefresh(req.app.get("io"), "relationship:update");
  res.json(relationship);
}));
relationshipRouter.delete("/:id", asyncHandler(async (req, res) => {
  const relationship = await deleteRelationship(userIdFromRequest(req), req.params.id);
  emitGraphRefresh(req.app.get("io"), "relationship:delete");
  res.json(relationship);
}));

// Dashboard routes
dashboardRouter.get("/graph", asyncHandler(async (req, res) => {
  const graph = await getDashboardGraph(userIdFromRequest(req));
  res.json(graph);
}));
dashboardRouter.get("/analytics", asyncHandler(async (req, res) => {
  const analytics = await runRelationshipAnalysis(userIdFromRequest(req));
  res.json(analytics);
}));
dashboardRouter.get("/events", asyncHandler(async (req, res) => {
  const events = await listEvents(userIdFromRequest(req));
  res.json(events);
}));
dashboardRouter.get("/simulation", asyncHandler(async (_req, res) => {
  res.json(await getSimulationState(userIdFromRequest(_req)));
}));
dashboardRouter.post("/simulation/toggle", asyncHandler(async (req, res) => {
  const state = setSimulationRunning(req.body.isRunning);
  emitGraphRefresh(req.app.get("io"), state.isRunning ? "simulation-resumed" : "simulation-paused");
  res.json(await getSimulationState());
}));
dashboardRouter.post("/simulation/tick", asyncHandler(async (req, res) => {
  const result = await runSimulationTick(userIdFromRequest(req), req.body.reason || "manual");
  await emitGraphRefresh(req.app.get("io"), "simulation-tick");
  res.json(result);
}));
dashboardRouter.post("/culprit/guess", asyncHandler(async (req, res) => {
  const result = await guessCulprit(userIdFromRequest(req), req.body.suspectId);
  await emitGraphRefresh(req.app.get("io"), "culprit-guess");
  res.json(result);
}));
dashboardRouter.post("/culprit/restart", asyncHandler(async (req, res) => {
  const result = await restartCulpritGame(userIdFromRequest(req));
  await emitGraphRefresh(req.app.get("io"), "culprit-restart");
  res.json(result);
}));

const { Person } = require("./src/models");
dashboardRouter.post("/characters/:id/promote", asyncHandler(async (req, res) => {
  const person = await Person.findOne({ _id: req.params.id, userId: userIdFromRequest(req) });
  if (!person) {
    const error = new Error("Character not found");
    error.status = 404;
    throw error;
  }
  person.powerLevel = Math.min(1000, person.powerLevel + 120);
  person.influenceScore = Math.min(100, person.influenceScore + 10);
  person.loyaltyScore = Math.min(100, person.loyaltyScore + 6);
  await person.save();
  await createEvent(userIdFromRequest(req), {
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
  const person = await Person.findOne({ _id: req.params.id, userId: userIdFromRequest(req) });
  if (!person) {
    const error = new Error("Character not found");
    error.status = 404;
    throw error;
  }
  person.status = "dead";
  person.powerLevel = 0;
  await person.save();
  await createEvent(userIdFromRequest(req), {
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

// Mount protected routes with authentication middleware
app.use("/api/people", authenticateToken, peopleRouter);
app.use("/api/relationships", authenticateToken, relationshipRouter);
app.use("/api/crimes", authenticateToken, crimeRouter);
app.use("/api/dashboard", authenticateToken, dashboardRouter);

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
      const { User } = require("./src/models");
      const users = await User.find({}, "_id").lean();
      const result = await Promise.all(users.map((user) => runSimulationTick(user._id, reason || "socket")));
      socketIo.emit("graph:refresh", { reason: "socket-tick", result, timestamp: new Date() });
    });
  });
}

async function bootstrap() {
  await connectDB(process.env.MONGODB_URI);
  await seedDatabase();

  registerSocketHandlers(io);
  startSimulation(async () => {
    const { User } = require("./src/models");
    const users = await User.find({}, "_id").lean();
    await Promise.all(users.map((user) => runSimulationTick(user._id, "auto")));
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
