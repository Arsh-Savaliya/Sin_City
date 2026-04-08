const express = require("express");
const controller = require("../controllers/dashboardController");

const router = express.Router();

router.get("/graph", controller.graph);
router.get("/analytics", controller.analytics);
router.get("/events", controller.events);
router.get("/simulation", controller.simulationState);
router.post("/simulation/toggle", controller.toggleSimulation);
router.post("/simulation/tick", controller.runTick);
router.post("/characters/:id/promote", controller.promoteCharacter);
router.post("/characters/:id/eliminate", controller.eliminateCharacter);

module.exports = router;
