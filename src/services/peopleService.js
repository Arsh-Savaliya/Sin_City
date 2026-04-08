const Person = require("../models/Person");
const Relationship = require("../models/Relationship");
const { handleSuccession, createEvent } = require("./simulationService");

async function listPeople(filters = {}) {
  const query = {};
  if (filters.role) {
    query.role = filters.role;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  return Person.find(query).sort({ influenceScore: -1, name: 1 });
}

async function createPerson(payload) {
  const person = await Person.create(payload);
  return person;
}

async function updatePerson(id, payload) {
  const person = await Person.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!person) {
    const error = new Error("Person not found");
    error.status = 404;
    throw error;
  }

  if (payload.status === "dead") {
    await Relationship.updateMany(
      {
        $or: [{ source: id }, { target: id }],
        status: { $ne: "severed" }
      },
      {
        $set: {
          status: "weakening"
        },
        $mul: {
          weight: 0.45
        }
      }
    );

    await createEvent({
      type: "elimination",
      headline: `${person.name} is dead`,
      summary: `${person.name} was marked dead, weakening connected alliances and command structures.`,
      actor: person._id,
      target: person._id,
      faction: person.faction
    });

    if (person.isBoss) {
      await handleSuccession(person);
    }
  }

  return person;
}

async function deletePerson(id) {
  const person = await Person.findByIdAndDelete(id);
  if (!person) {
    const error = new Error("Person not found");
    error.status = 404;
    throw error;
  }
  await Relationship.deleteMany({
    $or: [{ source: id }, { target: id }]
  });
  return person;
}

module.exports = {
  listPeople,
  createPerson,
  updatePerson,
  deletePerson
};
