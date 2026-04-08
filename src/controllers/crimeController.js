const asyncHandler = require("../utils/asyncHandler");
const crimeService = require("../services/crimeService");
const { emitGraphRefresh } = require("../socket");

exports.list = asyncHandler(async (_req, res) => {
  const crimes = await crimeService.listCrimes();
  res.json(crimes);
});

exports.create = asyncHandler(async (req, res) => {
  const crime = await crimeService.createCrime(req.body);
  emitGraphRefresh(req.app.get("io"), "crime:create");
  res.status(201).json(crime);
});

exports.update = asyncHandler(async (req, res) => {
  const crime = await crimeService.updateCrime(req.params.id, req.body);
  emitGraphRefresh(req.app.get("io"), "crime:update");
  res.json(crime);
});
