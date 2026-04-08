const asyncHandler = require("../utils/asyncHandler");
const peopleService = require("../services/peopleService");
const { emitGraphRefresh } = require("../socket");

exports.list = asyncHandler(async (req, res) => {
  const people = await peopleService.listPeople(req.query);
  res.json(people);
});

exports.create = asyncHandler(async (req, res) => {
  const person = await peopleService.createPerson(req.body);
  emitGraphRefresh(req.app.get("io"), "person:create");
  res.status(201).json(person);
});

exports.update = asyncHandler(async (req, res) => {
  const person = await peopleService.updatePerson(req.params.id, req.body);
  emitGraphRefresh(req.app.get("io"), "person:update");
  res.json(person);
});

exports.remove = asyncHandler(async (req, res) => {
  const person = await peopleService.deletePerson(req.params.id);
  emitGraphRefresh(req.app.get("io"), "person:delete");
  res.json(person);
});
