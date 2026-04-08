const asyncHandler = require("../utils/asyncHandler");
const relationshipService = require("../services/relationshipService");
const { emitGraphRefresh } = require("../socket");

exports.list = asyncHandler(async (_req, res) => {
  const data = await relationshipService.listRelationships();
  res.json(data);
});

exports.create = asyncHandler(async (req, res) => {
  const relationship = await relationshipService.createRelationship(req.body);
  emitGraphRefresh(req.app.get("io"), "relationship:create");
  res.status(201).json(relationship);
});

exports.update = asyncHandler(async (req, res) => {
  const relationship = await relationshipService.updateRelationship(req.params.id, req.body);
  emitGraphRefresh(req.app.get("io"), "relationship:update");
  res.json(relationship);
});

exports.remove = asyncHandler(async (req, res) => {
  const relationship = await relationshipService.deleteRelationship(req.params.id);
  emitGraphRefresh(req.app.get("io"), "relationship:delete");
  res.json(relationship);
});
