const asyncHandler = require("../utils/asyncHandler");
const { getDashboardGraph } = require("../services/graphService");
const { runRelationshipAnalysis } = require("../services/analyticsService");
const {
  listEvents,
  runSimulationTick,
  setSimulationRunning,
  getSimulationState,
  createEvent
} = require("../services/simulationService");
const Person = require("../models/Person");
const { emitGraphRefresh } = require("../socket");

exports.graph = asyncHandler(async (_req, res) => {
  const graph = await getDashboardGraph();
  res.json(graph);
});

exports.analytics = asyncHandler(async (_req, res) => {
  const analytics = await runRelationshipAnalysis();
  res.json(analytics);
});

exports.events = asyncHandler(async (_req, res) => {
  const events = await listEvents();
  res.json(events);
});

exports.simulationState = asyncHandler(async (_req, res) => {
  res.json(await getSimulationState());
});

exports.toggleSimulation = asyncHandler(async (req, res) => {
  const state = setSimulationRunning(req.body.isRunning);
  emitGraphRefresh(req.app.get("io"), state.isRunning ? "simulation-resumed" : "simulation-paused");
  res.json(await getSimulationState());
});

exports.runTick = asyncHandler(async (req, res) => {
  const result = await runSimulationTick(req.body.reason || "manual");
  await emitGraphRefresh(req.app.get("io"), "simulation-tick");
  res.json(result);
});

exports.promoteCharacter = asyncHandler(async (req, res) => {
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
});

exports.eliminateCharacter = asyncHandler(async (req, res) => {
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
});
