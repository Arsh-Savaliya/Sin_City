const Crime = require("../models/Crime");

async function listCrimes() {
  return Crime.find().populate("committedBy solvedBy").sort({ occurredAt: -1 });
}

async function createCrime(payload) {
  return Crime.create(payload);
}

async function updateCrime(id, payload) {
  const crime = await Crime.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  });
  if (!crime) {
    const error = new Error("Crime not found");
    error.status = 404;
    throw error;
  }
  return crime;
}

module.exports = {
  listCrimes,
  createCrime,
  updateCrime
};
