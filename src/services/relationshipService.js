const Relationship = require("../models/Relationship");

async function listRelationships() {
  return Relationship.find().populate("source target").sort({ updatedAt: -1 });
}

async function createRelationship(payload) {
  return Relationship.create(payload);
}

async function updateRelationship(id, payload) {
  const relationship = await Relationship.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  });
  if (!relationship) {
    const error = new Error("Relationship not found");
    error.status = 404;
    throw error;
  }
  return relationship;
}

async function deleteRelationship(id) {
  const relationship = await Relationship.findByIdAndDelete(id);
  if (!relationship) {
    const error = new Error("Relationship not found");
    error.status = 404;
    throw error;
  }
  return relationship;
}

module.exports = {
  listRelationships,
  createRelationship,
  updateRelationship,
  deleteRelationship
};
