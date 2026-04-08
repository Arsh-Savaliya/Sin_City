const Person = require("../models/Person");
const Relationship = require("../models/Relationship");
const Crime = require("../models/Crime");
const Event = require("../models/Event");
const { calculateDominance } = require("./powerService");

function normalize(value, max) {
  if (!max) {
    return 0;
  }
  return value / max;
}

async function runRelationshipAnalysis() {
  const [people, relationships, crimes, events] = await Promise.all([
    Person.find().lean(),
    Relationship.find().lean(),
    Crime.find().lean(),
    Event.find().sort({ happenedAt: -1 }).limit(40).lean()
  ]);

  const relationMap = new Map();
  for (const relation of relationships) {
    const key = [relation.source.toString(), relation.target.toString()].sort().join(":");
    relationMap.set(key, relation);
  }

  const maxMoney = Math.max(...people.map((person) => person.money || 0), 1);
  const maxCases = Math.max(...people.map((person) => person.cases || 0), 1);
  const maxSolved = Math.max(...people.map((person) => person.casesSolved || 0), 1);

  const degree = new Map();
  relationships.forEach((relation) => {
    degree.set(relation.source.toString(), (degree.get(relation.source.toString()) || 0) + relation.weight);
    degree.set(relation.target.toString(), (degree.get(relation.target.toString()) || 0) + relation.weight);
  });

  const criminals = people.filter((person) => person.role === "criminal");
  const officers = people.filter((person) => person.role === "police");
  const aliveCriminals = criminals.filter((person) => person.status === "alive");

  const mostInfluential = aliveCriminals
    .map((person) => ({
      ...person,
      aiScore:
        normalize(person.dominanceScore || calculateDominance(person), 900) * 0.5 +
        normalize(person.money, maxMoney) * 0.2 +
        normalize(degree.get(person._id.toString()) || 0, relationships.length || 1) * 0.3
    }))
    .sort((a, b) => b.aiScore - a.aiScore)[0];

  const suspiciousPolice = officers
    .map((officer) => {
      const corruptionLinks = relationships.filter(
        (link) =>
          link.type === "corruption" &&
          [link.source.toString(), link.target.toString()].includes(officer._id.toString())
      ).length;

      const linkedCriminals = relationships.filter(
        (link) =>
          [link.source.toString(), link.target.toString()].includes(officer._id.toString()) &&
          link.type !== "official"
      ).length;

      const suspiciousIndex =
        (1 - normalize(officer.integrityScore, 100)) * 0.45 +
        normalize(corruptionLinks, 5) * 0.35 +
        normalize(linkedCriminals, 8) * 0.2;

      return {
        ...officer,
        suspiciousIndex
      };
    })
    .sort((a, b) => b.suspiciousIndex - a.suspiciousIndex)
    .slice(0, 5);

  const coCrimeIndex = new Map();
  for (const crime of crimes) {
    const actors = crime.committedBy.map((entry) => entry.toString());
    for (let i = 0; i < actors.length; i += 1) {
      for (let j = i + 1; j < actors.length; j += 1) {
        const key = [actors[i], actors[j]].sort().join(":");
        coCrimeIndex.set(key, (coCrimeIndex.get(key) || 0) + 1);
      }
    }
  }

  const hiddenRelationships = Array.from(coCrimeIndex.entries())
    .filter(([key, count]) => !relationMap.has(key) && count > 0)
    .map(([key, count]) => {
      const [a, b] = key.split(":");
      const source = people.find((person) => person._id.toString() === a);
      const target = people.find((person) => person._id.toString() === b);
      return {
        sourceId: a,
        targetId: b,
        sourceName: source?.name,
        targetName: target?.name,
        confidence: Math.min(0.35 + count * 0.2, 0.95),
        reason: `${count} shared crime record(s) without an explicit relationship edge`
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);

  const crimePressure = crimes.reduce((acc, crime) => {
    const bucket = crime.district || "Unknown";
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  const nextDominantPlayer = aliveCriminals
    .map((person) => ({
      ...person,
      risePotential:
        normalize(person.ambitionLevel, 100) * 0.35 +
        normalize(person.intelligenceLevel, 100) * 0.25 +
        normalize(person.powerLevel, 1000) * 0.25 +
        normalize(100 - person.loyaltyScore, 100) * 0.15
    }))
    .sort((a, b) => b.risePotential - a.risePotential)[0];

  const likelyBetrayal = aliveCriminals
    .filter((person) => !person.isBoss)
    .map((person) => ({
      ...person,
      betrayalRisk:
        normalize(person.ambitionLevel, 100) * 0.45 +
        normalize(100 - person.loyaltyScore, 100) * 0.35 +
        normalize(person.intelligenceLevel, 100) * 0.2
    }))
    .sort((a, b) => b.betrayalRisk - a.betrayalRisk)[0];

  const unstableHierarchies = criminals
    .reduce((acc, person) => {
      const faction = person.faction || "Independent";
      if (!acc[faction]) {
        acc[faction] = [];
      }
      acc[faction].push(person);
      return acc;
    }, {})
    ;

  const instability = Object.entries(unstableHierarchies)
    .map(([faction, members]) => {
      const avgLoyalty =
        members.reduce((sum, member) => sum + (member.loyaltyScore || 0), 0) / members.length;
      const avgAmbition =
        members.reduce((sum, member) => sum + (member.ambitionLevel || 0), 0) / members.length;
      const livingBoss = members.find((member) => member.isBoss && member.status === "alive");
      const score = normalize(100 - avgLoyalty, 100) * 0.45 + normalize(avgAmbition, 100) * 0.35 + (!livingBoss ? 0.2 : 0);
      return {
        faction,
        instabilityScore: score,
        hasLivingBoss: Boolean(livingBoss),
        memberCount: members.length
      };
    })
    .sort((a, b) => b.instabilityScore - a.instabilityScore);

  const corruptionClusters = relationships
    .filter((link) => link.type === "corruption")
    .map((link) => ({
      sourceId: link.source.toString(),
      targetId: link.target.toString(),
      tensionScore: link.tensionScore,
      weight: link.weight
    }));

  return {
    summary: {
      nodeCount: people.length,
      edgeCount: relationships.length,
      crimeCount: crimes.length,
      solvedRate: crimes.length
        ? crimes.filter((crime) => crime.status === "solved").length / crimes.length
        : 0
    },
    mostInfluential,
    nextDominantPlayer,
    likelyBetrayal,
    suspiciousPolice,
    hiddenRelationships,
    crimePressure,
    unstableHierarchies: instability.slice(0, 5),
    corruptionClusters,
    recentEvents: events.slice(0, 8)
  };
}

module.exports = {
  runRelationshipAnalysis
};
