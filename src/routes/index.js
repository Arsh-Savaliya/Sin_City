const express = require("express");
const peopleRoutes = require("./peopleRoutes");
const relationshipRoutes = require("./relationshipRoutes");
const crimeRoutes = require("./crimeRoutes");
const dashboardRoutes = require("./dashboardRoutes");

function createApiRouter() {
  const router = express.Router();
  router.use("/people", peopleRoutes);
  router.use("/relationships", relationshipRoutes);
  router.use("/crimes", crimeRoutes);
  router.use("/dashboard", dashboardRoutes);
  return router;
}

module.exports = createApiRouter;
