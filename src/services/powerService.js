const Person = require("../models/Person");

function calculateDominance(person) {
  return (
    (person.powerLevel || 0) * 0.45 +
    (person.influenceScore || 0) * 3 +
    (person.fearFactor || 0) * 2 +
    (person.intelligenceLevel || 0) * 1.2
  );
}

async function refreshDominanceScores(personIds = null) {
  const query = personIds?.length ? { _id: { $in: personIds } } : {};
  const people = await Person.find(query);

  await Promise.all(
    people.map((person) => {
      person.dominanceScore = calculateDominance(person);
      return person.save();
    })
  );

  return people;
}

function successorScore(person) {
  return (
    (person.powerLevel || 0) * 0.5 +
    (person.loyaltyScore || 0) * 2.25 +
    (person.intelligenceLevel || 0) * 2 +
    (person.dominanceScore || calculateDominance(person)) * 0.15
  );
}

module.exports = {
  calculateDominance,
  refreshDominanceScores,
  successorScore
};
