const mongoose = require("mongoose");
const { Person, Crime, Relationship, Event } = require("./models");

function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }
  mongoose.set("strictQuery", true);
  return mongoose.connect(uri, { autoIndex: true });
}

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function calculateDominance(person) {
  return (
    (person.powerLevel || 0) * 0.45 +
    (person.influenceScore || 0) * 3 +
    (person.fearFactor || 0) * 2 +
    (person.intelligenceLevel || 0) * 1.2
  );
}

function successorScore(person) {
  return (
    (person.powerLevel || 0) * 0.5 +
    (person.loyaltyScore || 0) * 2.25 +
    (person.intelligenceLevel || 0) * 2 +
    (person.dominanceScore || calculateDominance(person)) * 0.15
  );
}

async function refreshDominanceScores(personIds = null, userId = null) {
  const query = personIds?.length ? { _id: { $in: personIds } } : {};
  if (userId) {
    query.userId = userId;
  }
  const people = await Person.find(query);
  await Promise.all(
    people.map((person) => {
      person.dominanceScore = calculateDominance(person);
      return person.save();
    })
  );
  return people;
}

async function listPeople(userId, filters = {}) {
  const query = { userId, isInWorld: { $ne: false } };
  if (filters.role) {
    query.role = filters.role;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  return Person.find(query).sort({ influenceScore: -1, name: 1 });
}

async function createPerson(userId, payload) {
  return Person.create({ ...payload, userId });
}

async function updatePerson(userId, id, payload) {
  const person = await Person.findOneAndUpdate({ _id: id, userId }, payload, { new: true, runValidators: true });
  if (!person) {
    const error = new Error("Person not found");
    error.status = 404;
    throw error;
  }
  if (payload.status === "dead") {
    await Relationship.updateMany(
      {
        $or: [{ source: id }, { target: id }],
        status: { $ne: "severed" },
        userId
      },
      {
        $set: { status: "weakening" },
        $mul: { weight: 0.45 }
      }
    );
    await createEvent(userId, {
      type: "elimination",
      headline: `${person.name} is dead`,
      summary: `${person.name} was marked dead`,
      actor: person._id,
      target: person._id,
      faction: person.faction
    });
  }
  return person;
}

async function deletePerson(userId, id) {
  const person = await Person.findOneAndDelete({ _id: id, userId });
  if (!person) {
    const error = new Error("Person not found");
    error.status = 404;
    throw error;
  }
  await Relationship.deleteMany({
    $or: [{ source: id }, { target: id }],
    userId
  });
  return person;
}

async function listCrimes(userId) {
  return Crime.find({ userId }).populate("committedBy solvedBy").sort({ occurredAt: -1 });
}

async function createCrime(userId, payload) {
  return Crime.create({ ...payload, userId });
}

async function updateCrime(userId, id, payload) {
  const crime = await Crime.findOneAndUpdate({ _id: id, userId }, payload, {
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

async function listRelationships(userId) {
  return Relationship.find({ userId }).populate("source target").sort({ updatedAt: -1 });
}

async function createRelationship(userId, payload) {
  return Relationship.create({ ...payload, userId });
}

async function updateRelationship(userId, id, payload) {
  const relationship = await Relationship.findOneAndUpdate({ _id: id, userId }, payload, {
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

async function deleteRelationship(userId, id) {
  const relationship = await Relationship.findOneAndDelete({ _id: id, userId });
  if (!relationship) {
    const error = new Error("Relationship not found");
    error.status = 404;
    throw error;
  }
  return relationship;
}

async function getDashboardGraph(userId) {
  const [peopleRaw, relationships, crimesRaw, eventsRaw] = await Promise.all([
    Person.find({ userId, isInWorld: { $ne: false } }).lean(),
    Relationship.find({ userId }).populate("source target").lean(),
    Crime.find({ userId }).populate("committedBy solvedBy").sort({ occurredAt: -1 }).lean(),
    Event.find({ userId }).populate("actor target").sort({ happenedAt: -1 }).limit(30).lean()
  ]);

  const sanitizedRelationships = (relationships || [])
    .map((relationship) => ({
      ...relationship,
      source: sanitizePersonForClient(relationship.source),
      target: sanitizePersonForClient(relationship.target)
    }))
    .filter((relationship) => relationship.source && relationship.target);
  const crimes = (crimesRaw || []).map((crime) => ({
    ...crime,
    committedBy: (crime.committedBy || []).map((person) => sanitizePersonForClient(person)).filter(Boolean),
    solvedBy: sanitizePersonForClient(crime.solvedBy)
  }));
  const events = (eventsRaw || []).map((event) => ({
    ...event,
    actor: sanitizePersonForClient(event.actor),
    target: sanitizePersonForClient(event.target)
  }));
  const people = sanitizePeopleForClient(enrichPeopleForDashboard(peopleRaw, crimesRaw, eventsRaw, relationships));
  const criminals = people.filter((person) => person.role === "criminal");
  const police = people.filter((person) => person.role === "police");

  const policeLinks = sanitizedRelationships.filter(
    (link) =>
      link.type === "official" &&
      link.source?.role === "police" &&
      link.target?.role === "police"
  );
  return {
    people,
    crimes,
    events,
    views: {
      criminalNetwork: {
        nodes: criminals,
        links: sanitizedRelationships.filter(
          (link) =>
            link.source?.role === "criminal" &&
            link.target?.role === "criminal"
        )
      },
      policeNetwork: {
        nodes: police,
        links: policeLinks
      },
      corruptionNetwork: {
        nodes: people.filter((person) => person.role === "criminal" || person.isCorrupt),
        links: sanitizedRelationships.filter(
          (link) =>
            ["alliance", "rivalry", "transaction", "official", "corruption"].includes(link.type) &&
            [link.source?._id?.toString(), link.target?._id?.toString()].every(Boolean)
        )
      }
    }
  };
}

function enrichPeopleForDashboard(people, crimes, events, relationships) {
  const crimeCounts = new Map();
  const murderCounts = new Map();
  const encounterCounts = new Map();
  const corruptionExposure = new Map();

  crimes.forEach((crime) => {
    (crime.committedBy || []).forEach((entry) => {
      const id = (entry?._id || entry)?.toString();
      if (!id) {
        return;
      }
      crimeCounts.set(id, (crimeCounts.get(id) || 0) + 1);
    });
  });

  events.forEach((event) => {
    const actorId = event.actor?._id?.toString() || event.actor?.toString();
    if (!actorId) {
      return;
    }

    if (["assassination", "elimination"].includes(event.type)) {
      murderCounts.set(actorId, (murderCounts.get(actorId) || 0) + 1);
    }

    if (["raid", "investigation", "elimination", "assassination"].includes(event.type)) {
      encounterCounts.set(actorId, (encounterCounts.get(actorId) || 0) + 1);
    }
  });

  relationships.forEach((relationship) => {
    if (relationship.type !== "corruption") {
      return;
    }
    const sourceId = relationship.source?._id?.toString() || relationship.source?.toString();
    const targetId = relationship.target?._id?.toString() || relationship.target?.toString();
    [sourceId, targetId].forEach((id) => {
      if (id) {
        corruptionExposure.set(id, (corruptionExposure.get(id) || 0) + (relationship.weight || 1));
      }
    });
  });

  return people.map((person) => {
    const personId = person._id.toString();
    const totalCrimes = crimeCounts.get(personId) || 0;
    const murders = person.murders || murderCounts.get(personId) || 0;
    const encounters = person.encounters || encounterCounts.get(personId) || 0;
    const underworldPower = person.isCorrupt
      ? Math.round(
          (person.powerLevel || 0) * 0.25 +
          (person.influenceScore || 0) * 2 +
          (corruptionExposure.get(personId) || 0) * 14
        )
      : 0;

    return {
      ...person,
      totalCrimes,
      murders,
      encounters,
      underworldPower
    };
  });
}

function sanitizePersonForClient(person) {
  if (!person) {
    return person;
  }

  if (person.isInWorld === false) {
    return null;
  }

  const { isCulprit, clueProfile, ...safePerson } = person;
  return safePerson;
}

function sanitizePeopleForClient(people) {
  return (people || []).map((person) => sanitizePersonForClient(person)).filter(Boolean);
}

async function runRelationshipAnalysis(userId) {
  const [peopleRaw, relationships, crimes, events] = await Promise.all([
    Person.find({ userId, isInWorld: { $ne: false } }).lean(),
    Relationship.find({ userId }).lean(),
    Crime.find({ userId }).lean(),
    Event.find({ userId }).sort({ happenedAt: -1 }).limit(40).lean()
  ]);
  const people = enrichPeopleForDashboard(peopleRaw, crimes, events, relationships);

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
        (person.dominanceScore || calculateDominance(person)) / 900 * 0.5 +
        (person.money || 0) / maxMoney * 0.2 +
        (degree.get(person._id.toString()) || 0) / (relationships.length || 1) * 0.3
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
        (1 - (officer.integrityScore || 0) / 100) * 0.45 +
        corruptionLinks / 5 * 0.35 +
        linkedCriminals / 8 * 0.2;

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
        (person.ambitionLevel || 0) / 100 * 0.35 +
        (person.intelligenceLevel || 0) / 100 * 0.25 +
        (person.powerLevel || 0) / 1000 * 0.25 +
        (100 - (person.loyaltyScore || 0)) / 100 * 0.15
    }))
    .sort((a, b) => b.risePotential - a.risePotential)[0];

  const likelyBetrayal = aliveCriminals
    .filter((person) => !person.isBoss)
    .map((person) => ({
      ...person,
      betrayalRisk:
        (person.ambitionLevel || 0) / 100 * 0.45 +
        (100 - (person.loyaltyScore || 0)) / 100 * 0.35 +
        (person.intelligenceLevel || 0) / 100 * 0.2
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
    }, {});

  const instability = Object.entries(unstableHierarchies)
    .map(([faction, members]) => {
      const avgLoyalty =
        members.reduce((sum, member) => sum + (member.loyaltyScore || 0), 0) / members.length;
      const avgAmbition =
        members.reduce((sum, member) => sum + (member.ambitionLevel || 0), 0) / members.length;
      const livingBoss = members.find((member) => member.isBoss && member.status === "alive");
      const score = (100 - avgLoyalty) / 100 * 0.45 + avgAmbition / 100 * 0.35 + (!livingBoss ? 0.2 : 0);
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
    mostInfluential: sanitizePersonForClient(mostInfluential),
    nextDominantPlayer: sanitizePersonForClient(nextDominantPlayer),
    likelyBetrayal: sanitizePersonForClient(likelyBetrayal),
    suspiciousPolice,
    hiddenRelationships,
    crimePressure,
    unstableHierarchies: instability.slice(0, 5),
    corruptionClusters,
    recentEvents: events.slice(0, 8)
  };
}

const simulationState = {
  isRunning: true,
  intervalMs: 40000,
  timer: null,
  lastTickAt: null,
  populationPressureThreshold: 3
};

const firstNames = ["Kiran", "Viktor", "Sable", "Arin", "Dev", "Mira", "Zaid", "Nael", "Rhea", "Tarin"];
const lastNames = ["Kale", "Morrow", "Dane", "Vale", "Soren", "Rook", "Cass", "Thorne", "Kestrel", "Voss"];
const aliases = ["Coal Jackal", "Iron Veil", "Knuckle Psalm", "Night Broker", "Ash Fang", "Dust Widow"];
const weaknessPool = ["greed", "fear", "loyalty conflict", "ego", "legal pressure"];

const backgroundProfiles = {
  powerful: {
    power: [420, 760],
    influence: [52, 88],
    fear: [58, 92],
    intelligence: [60, 93],
    loyalty: [42, 84],
    ambition: [44, 78],
    money: [320000, 2200000],
    cases: [3, 8]
  },
  balanced: {
    power: [240, 430],
    influence: [28, 54],
    fear: [30, 58],
    intelligence: [48, 78],
    loyalty: [28, 64],
    ambition: [52, 84],
    money: [90000, 480000],
    cases: [1, 5]
  },
  weak: {
    power: [90, 240],
    influence: [14, 36],
    fear: [16, 42],
    intelligence: [34, 70],
    loyalty: [18, 56],
    ambition: [64, 98],
    money: [18000, 170000],
    cases: [0, 3]
  }
};

const cityDistricts = ["Harbor District", "North Spine", "Old Quarter", "Red Market", "Ash Avenue", "Port Meridian"];
const culpritMethods = ["silenced pistol", "burner-ledger trail", "dockside knife work", "ghost-transfer fraud", "witness coercion"];
const culpritTells = ["smells of clove smoke", "always leaves a black token", "uses left-handed strikes", "bribes through charity fronts", "travels with a harbor pass"];
const culpritTraits = ["cold patience", "reckless ambition", "ritual precision", "quiet vanity", "street-level charm"];
const proceduralCrimeCatalog = [
  { category: "Smuggling", title: "Dockside Ghost Run", summary: "Unmarked cargo slipped through a protected corridor.", violent: false },
  { category: "Racketeering", title: "Protection Sweep", summary: "Shopkeepers folded after a coordinated intimidation push.", violent: false },
  { category: "Homicide", title: "Back-Alley Execution", summary: "A targeted killing sent a warning through the district.", violent: true },
  { category: "Cyber Fraud", title: "Ledger Breach", summary: "Shell accounts were hit through a precision laundering route.", violent: false },
  { category: "Arms Trade", title: "Black Market Reload", summary: "A fresh gun line appeared under cover of city noise.", violent: true }
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pickRandom(items) {
  if (!items.length) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeaknesses() {
  return weaknessPool
    .filter(() => Math.random() > 0.55)
    .slice(0, 2)
    .concat(Math.random() > 0.7 ? [pickRandom(weaknessPool)] : [])
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .slice(0, 2);
}

function inferBackgroundTier(person) {
  if (person.isBoss || (person.powerLevel || 0) >= 520 || (person.dominanceScore || 0) >= 520) {
    return "powerful";
  }
  if ((person.powerLevel || 0) <= 220 || person.isOutsider) {
    return "weak";
  }
  return "balanced";
}

function buildCharacterLore(person, backgroundTier = inferBackgroundTier(person)) {
  const faction = person.faction || "the city margins";
  const alias = person.alias ? ` known on the street as ${person.alias}` : "";
  const roleLabel = person.role === "police" ? "enforcer" : "operator";

  if (backgroundTier === "powerful") {
    return {
      backgroundTier,
      backgroundSummary: "Powerful roots with access to money, fear, and old alliances.",
      backstory: `${person.name}${alias} rose out of a house that already understood leverage. Before arriving in ${faction}, ${person.name} learned to trade favors, intimidation, and blood loyalty as if they were the same currency. That background still shapes every move, making ${person.name} dangerous long before a fight actually starts.`
    };
  }

  if (backgroundTier === "weak") {
    return {
      backgroundTier,
      backgroundSummary: "Weak beginnings built on desperation, grit, and the need to climb.",
      backstory: `${person.name}${alias} came in from the bottom with almost nothing to protect and even less to lose. ${person.name} survived as a disposable ${roleLabel} around ${faction}, learning how hunger, humiliation, and pressure expose cracks in stronger people. That thin beginning leaves ${person.name} vulnerable, but it also makes ambition burn hotter than caution.`
    };
  }

  return {
    backgroundTier,
    backgroundSummary: "A middle-ground background shaped by service, hustling, and strategic patience.",
    backstory: `${person.name}${alias} was not born into the throne room and not buried in the gutter either. Years spent moving between crews, favors, and street-level negotiations in ${faction} taught ${person.name} when to bow, when to wait, and when to take ground without warning. That balanced past makes ${person.name} adaptable enough to survive sudden shifts in power.`
  };
}

async function hydrateLoreProfiles() {
  const people = await Person.find({
    $or: [
      { backgroundTier: { $exists: false } },
      { backgroundTier: null },
      { backgroundSummary: { $exists: false } },
      { backgroundSummary: null },
      { backstory: { $exists: false } },
      { backstory: null }
    ]
  });

  await Promise.all(
    people.map(async (person) => {
      const lore = buildCharacterLore(person);
      person.backgroundTier = person.backgroundTier || lore.backgroundTier;
      person.backgroundSummary = person.backgroundSummary || lore.backgroundSummary;
      person.backstory = person.backstory || lore.backstory;
      await person.save();
    })
  );
}

async function uniqueGeneratedName(userId = null) {
  let attempts = 0;

  while (attempts < 24) {
    const name = `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
    const query = userId ? { userId, name } : { name };
    const existing = await Person.exists(query);
    if (!existing) {
      return name;
    }
    attempts += 1;
  }

  return `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
}

function clampSummary(text, maxLength = 420) {
  if (!text) {
    return text;
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

async function generateCharacterLore({ person, fallbackLore, anchorName, worldState }) {
  return {
    backgroundTier: fallbackLore.backgroundTier,
    backgroundSummary: clampSummary(fallbackLore.backgroundSummary, 160),
    backstory: clampSummary(fallbackLore.backstory, 700),
    source: "local"
  };
}

async function generateEventNarrative({ type, headline, summary, actorId, targetId, faction, metadata = {} }) {
  return {
    headline: clampSummary(headline, 70),
    summary: clampSummary(summary, 220),
    source: "local"
  };
}

async function createEvent(userIdOrPayload, payload) {
  const actualPayload = payload || userIdOrPayload;
  const actualUserId = payload ? userIdOrPayload : null;
  
  const narrative = await generateEventNarrative({
    type: actualPayload.type,
    headline: actualPayload.headline,
    summary: actualPayload.summary,
    actorId: actualPayload.actor,
    targetId: actualPayload.target,
    faction: actualPayload.faction,
    metadata: actualPayload.metadata
  });

  return Event.create({
    ...actualPayload,
    headline: narrative.headline,
    summary: narrative.summary,
    metadata: {
      ...(actualPayload.metadata || {}),
      narrationSource: narrative.source
    },
    ...(actualUserId && { userId: actualUserId })
  });
}

function withOptionalUserId(userId, query = {}) {
  return userId ? { ...query, userId } : query;
}

async function listEvents(userId, limit = 25) {
  return Event.find({ userId }).populate("actor target").sort({ happenedAt: -1 }).limit(limit).lean();
}

async function getPopulationBalance(userId = null) {
  const [generatedCount, killCount, aliveCount, deadCount] = await Promise.all([
    Event.countDocuments(withOptionalUserId(userId, {
      $or: [{ type: "emergence" }, { "metadata.generated": true }]
    })),
    Event.countDocuments(withOptionalUserId(userId, {
      $or: [{ type: "assassination" }, { type: "elimination" }]
    })),
    Person.countDocuments(withOptionalUserId(userId, { status: "alive" })),
    Person.countDocuments(withOptionalUserId(userId, { status: "dead" }))
  ]);

  const surplus = generatedCount - killCount;
  const pressure =
    surplus >= simulationState.populationPressureThreshold
      ? "high"
      : surplus >= Math.max(1, simulationState.populationPressureThreshold - 1)
        ? "rising"
        : "stable";

  return { generatedCount, killCount, aliveCount, deadCount, surplus, pressure, threshold: simulationState.populationPressureThreshold };
}

function buildChangeSummary(before, after, labels) {
  return Object.entries(labels)
    .map(([key, label]) => {
      const delta = (after[key] || 0) - (before[key] || 0);
      if (!delta) {
        return null;
      }
      const prefix = delta > 0 ? "+" : "";
      return `${label} ${prefix}${delta}`;
    })
    .filter(Boolean)
    .join(", ");
}

async function recalibrateIndividual(userId, person, deltas, reason) {
  if (!person) {
    return null;
  }

  const before = {
    powerLevel: person.powerLevel || 0,
    influenceScore: person.influenceScore || 0,
    fearFactor: person.fearFactor || 0,
    loyaltyScore: person.loyaltyScore || 0
  };

  person.powerLevel = clamp((person.powerLevel || 0) + (deltas.powerLevel || 0), 0, 1000);
  person.influenceScore = clamp((person.influenceScore || 0) + (deltas.influenceScore || 0), 0, 100);
  person.fearFactor = clamp((person.fearFactor || 0) + (deltas.fearFactor || 0), 0, 100);
  person.loyaltyScore = clamp((person.loyaltyScore || 0) + (deltas.loyaltyScore || 0), 0, 100);
  await person.save();

  const summary = buildChangeSummary(before, person, {
    powerLevel: "power",
    influenceScore: "influence",
    fearFactor: "fear",
    loyaltyScore: "loyalty"
  });

  if (summary) {
    await createEvent(userId, {
      type: "recalibration",
      headline: `${person.name} recalibrates`,
      summary: `${person.name} adjusted after ${reason}: ${summary}.`,
      actor: person._id,
      faction: person.faction,
      metadata: { reason, deltas }
    });
  }

  return person;
}

function nextCrimeId() {
  return `SC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function killResistanceScore(person) {
  return (
    (person.dominanceScore || 0) * 0.11 +
    (person.powerLevel || 0) * 0.06 +
    (person.fearFactor || 0) * 1.2 +
    (person.intelligenceLevel || 0) * 0.9 +
    (person.isBoss ? 42 : 0)
  );
}

function vulnerabilityScore(person) {
  return (
    220 -
    (person.powerLevel || 0) * 0.18 -
    (person.dominanceScore || 0) * 0.12 -
    (person.fearFactor || 0) * 0.9 -
    (person.intelligenceLevel || 0) * 0.7 -
    (person.isBoss ? 55 : 0) +
    (person.isOutsider ? 24 : 0) +
    (100 - (person.loyaltyScore || 0)) * 0.35
  );
}

async function handleSuccession(deadBoss, userId = null) {
  const candidates = await Person.find({
    ...(userId && { userId }),
    _id: { $in: deadBoss.heirCandidates || [] },
    status: "alive"
  });

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => successorScore(b) - successorScore(a));
  const successor = candidates[0];

  await Person.updateMany(withOptionalUserId(userId, { faction: deadBoss.faction, isBoss: true }), { $set: { isBoss: false } });
  successor.isBoss = true;
  successor.rank = "Boss";
  successor.powerLevel = clamp(successor.powerLevel + 180, 0, 1000);
  successor.fearFactor = clamp(successor.fearFactor + 22, 0, 100);
  successor.influenceScore = clamp(successor.influenceScore + 15, 0, 100);
  successor.loyaltyScore = clamp(successor.loyaltyScore + 12, 0, 100);
  await successor.save();

  const defectors = await Person.find({
    ...(userId && { userId }),
    faction: deadBoss.faction,
    status: "alive",
    _id: { $ne: successor._id },
    loyaltyScore: { $lt: 45 }
  });

  await Promise.all(
    defectors.map(async (person) => {
      person.faction = person.isOutsider ? person.faction : "Independent";
      person.powerLevel = clamp(person.powerLevel + 40, 0, 1000);
      person.ambitionLevel = clamp(person.ambitionLevel + 10, 0, 100);
      await person.save();
      await Relationship.updateMany(
        withOptionalUserId(userId, {
          $or: [{ source: person._id }, { target: person._id }],
          type: "command"
        }),
        {
          $set: { status: "severed" }
        }
      );
    })
  );

  await createEvent(userId, {
    type: "succession",
    headline: `${successor.name} claims the throne`,
    summary: `${successor.name} inherited ${deadBoss.faction} after ${deadBoss.name} fell. ${defectors.length} member(s) defected in the aftermath.`,
    actor: successor._id,
    target: deadBoss._id,
    faction: deadBoss.faction,
    metadata: {
      defectors: defectors.map((person) => person.name),
      previousBoss: deadBoss.name
    }
  });

  await refreshDominanceScores([successor._id, ...defectors.map((person) => person._id)]);

  return successor;
}

async function markPersonDead(person, eventPayload, userId = null) {
  if (!person || person.status === "dead") {
    return false;
  }

  person.status = "dead";
  person.powerLevel = 0;
  person.fearFactor = 0;
  person.loyaltyScore = 0;
  await person.save();

  await Relationship.updateMany(
    withOptionalUserId(userId, {
      $or: [{ source: person._id }, { target: person._id }]
    }),
    {
      $set: { status: "weakening" }
    }
  );

  await createEvent(userId, {
    type: eventPayload.type || "elimination",
    headline: eventPayload.headline,
    summary: eventPayload.summary,
    actor: eventPayload.actor,
    target: person._id,
    faction: eventPayload.faction || person.faction,
    metadata: eventPayload.metadata || {}
  });

  if (person.isBoss) {
    await handleSuccession(person, userId);
  }

  return true;
}

async function assassinationAttempt(userId = null) {
  const rivalries = await Relationship.find(withOptionalUserId(userId, {
    type: "rivalry",
    tensionScore: { $gte: 65 },
    status: "active"
  })).populate("source target");

  const rivalryCandidates = rivalries
    .filter((link) => link.source?.status === "alive" && link.target?.status === "alive" && !link.target?.isCulprit)
    .sort((a, b) => vulnerabilityScore(b.target) - vulnerabilityScore(a.target));
  const rivalry = pickRandom(rivalryCandidates.slice(0, 3));
  if (!rivalry) {
    return null;
  }

  const attacker = rivalry.source;
  const target = rivalry.target;
  const successChance =
    (attacker.powerLevel + attacker.ambitionLevel + attacker.intelligenceLevel) / 24 -
    target.fearFactor / 8 -
    killResistanceScore(target) / 12;

  const protectedTarget =
    target.isBoss ||
    (target.dominanceScore || 0) >= 620 ||
    (target.powerLevel || 0) >= 720;

  if (successChance > (protectedTarget ? 70 : 55)) {
    rivalry.status = "weakening";
    rivalry.weight = clamp(rivalry.weight * 0.35, 0, 4);
    rivalry.tensionScore = 100;
    await rivalry.save();

    await markPersonDead(target, {
      type: "assassination",
      headline: `${attacker.name} struck down ${target.name}`,
      summary: `A high-tension rivalry snapped into violence. ${target.name} was eliminated in a power move.`,
      actor: attacker._id,
      faction: attacker.faction,
      metadata: { tensionScore: rivalry.tensionScore, aiKill: true }
    }, userId);

    await recalibrateIndividual(
      userId,
      attacker,
      {
        powerLevel: 18,
        influenceScore: 6,
        fearFactor: 10
      },
      `the hit on ${target.name}`
    );

    await refreshDominanceScores([attacker._id, target._id]);
    return true;
  }

  rivalry.tensionScore = clamp(rivalry.tensionScore + (protectedTarget ? 8 : 12), 0, 100);
  await rivalry.save();
  return false;
}

async function outsiderRise(userId = null) {
  const outsiders = await Person.find(withOptionalUserId(userId, {
    isOutsider: true,
    status: "alive"
  }));

  const outsider = pickRandom(outsiders);
  if (!outsider) {
    return null;
  }

  const weakTargets = await Person.find(withOptionalUserId(userId, {
    status: "alive",
    _id: { $ne: outsider._id },
    $or: [{ loyaltyScore: { $lt: 45 } }, { powerLevel: { $lt: 260 } }]
  })).sort({ loyaltyScore: 1, powerLevel: 1 });

  const target = pickRandom(weakTargets);
  if (!target) {
    return null;
  }

  const exploitTag =
    target.weaknessTags.includes("greed")
      ? "bribe"
      : target.weaknessTags.includes("loyalty conflict")
        ? "recruitment"
        : target.weaknessTags.includes("fear")
          ? "intimidation"
          : "ego";

  target.ambitionLevel = clamp(target.ambitionLevel + 8, 0, 100);
  await target.save();

  await recalibrateIndividual(
    userId,
    outsider,
    {
      powerLevel: 45,
      influenceScore: 6,
      fearFactor: 4
    },
    `exploiting ${target.name}`
  );
  await recalibrateIndividual(
    userId,
    target,
    {
      loyaltyScore: -12,
      powerLevel: -6
    },
    `being manipulated by ${outsider.name}`
  );

  await Relationship.findOneAndUpdate(
    withOptionalUserId(userId, {
      source: outsider._id,
      target: target._id,
      type: "alliance"
    }),
    {
      $set: {
        source: outsider._id,
        target: target._id,
        type: "alliance",
        status: "active",
        ...(userId && { userId }),
        details: `${outsider.name} exploited ${target.name}'s ${exploitTag} weakness.`,
        tensionScore: 28
      },
      $inc: { weight: 1 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await createEvent(userId, {
    type: "alliance",
    headline: `${outsider.name} gains ground`,
    summary: `${outsider.name} used ${exploitTag} tactics against ${target.name}, turning weakness into influence.`,
    actor: outsider._id,
    target: target._id,
    faction: outsider.faction,
    metadata: { exploitTag }
  });

  await refreshDominanceScores([outsider._id, target._id]);
  return outsider;
}

async function generateEmergentCharacter(userId = null) {
  const balance = await getPopulationBalance(userId);
  if (balance.surplus >= simulationState.populationPressureThreshold) {
    return null;
  }

  const factions = await Person.aggregate([
    { $match: withOptionalUserId(userId, { role: "criminal", status: "alive" }) },
    { $group: { _id: "$faction", count: { $sum: 1 }, avgLoyalty: { $avg: "$loyaltyScore" } } },
    { $sort: { avgLoyalty: 1, count: 1 } }
  ]);

  const targetFaction = factions[0]?._id || "Outlands";
  const name = await uniqueGeneratedName(userId);
  const isOutsider = Math.random() > 0.45;
  const backgroundTier = pickRandom(["powerful", "balanced", "weak"]);
  const profile = backgroundProfiles[backgroundTier];
  const role = Math.random() > 0.82 ? "police" : "criminal";
  const alias = pickRandom(aliases);

  const person = await Person.create({
    ...(userId && { userId }),
    name,
    alias,
    role,
    faction: isOutsider ? "Outlands" : targetFaction,
    rank: isOutsider ? "Outsider" : role === "police" ? "Detective" : "Lieutenant",
    money: randomInt(profile.money[0], profile.money[1]),
    cases: randomInt(profile.cases[0], profile.cases[1]),
    crimesCommitted: role === "criminal" ? (isOutsider ? ["Smuggling", "Conspiracy"] : ["Extortion"]) : [],
    influenceScore: randomInt(profile.influence[0], profile.influence[1]),
    powerLevel: randomInt(profile.power[0], profile.power[1]),
    loyaltyScore: isOutsider ? randomInt(12, 34) : randomInt(profile.loyalty[0], profile.loyalty[1]),
    ambitionLevel: randomInt(profile.ambition[0], profile.ambition[1]),
    fearFactor: randomInt(profile.fear[0], profile.fear[1]),
    intelligenceLevel: randomInt(profile.intelligence[0], profile.intelligence[1]),
    isOutsider,
    isCorrupt: role === "police" ? Math.random() > 0.84 : Math.random() > 0.9,
    weaknessTags: pickWeaknesses()
  });

  const anchor = await Person.findOne({
    ...(userId && { userId }),
    faction: person.faction,
    status: "alive",
    _id: { $ne: person._id }
  }).sort({ dominanceScore: -1 });

  const lore = buildCharacterLore(person, backgroundTier);
  const enrichedLore = await generateCharacterLore({
    person,
    fallbackLore: lore,
    anchorName: anchor?.name,
    worldState: balance
  });
  person.backgroundTier = enrichedLore.backgroundTier;
  person.backgroundSummary = enrichedLore.backgroundSummary;
  person.backstory = enrichedLore.backstory;
  person.notes = isOutsider
    ? "AI-generated operator seeking a foothold in the city."
    : "AI-generated climber inserted into a shaky faction.";
  await person.save();

  if (anchor) {
    await Relationship.create({
      ...(userId && { userId }),
      source: person._id,
      target: anchor._id,
      type: isOutsider ? "alliance" : "command",
      weight: isOutsider ? 1 : 2,
      tensionScore: isOutsider ? 48 : 22,
      details: isOutsider
        ? `${person.name} entered the city through ${anchor.name}.`
        : `${person.name} was attached to ${anchor.name}'s structure.`
    });

    if (
      anchor.isBoss &&
      !anchor.heirCandidates.some((id) => id.toString() === person._id.toString()) &&
      Math.random() > 0.5
    ) {
      anchor.heirCandidates.push(person._id);
      await anchor.save();
    }
  }

  await createEvent(userId, {
    type: "emergence",
    headline: `${person.name} enters the board`,
    summary: `${person.name}, known as ${person.alias}, arrived with a ${backgroundTier} background and ${person.powerLevel} power.`,
    actor: person._id,
    target: anchor?._id,
    faction: person.faction,
    metadata: { generated: true, isOutsider, backgroundTier: enrichedLore.backgroundTier, loreSource: enrichedLore.source }
  });

  await refreshDominanceScores([person._id, anchor?._id].filter(Boolean));
  return person;
}

async function betrayalEvent(userId = null) {
  const candidates = await Person.find(withOptionalUserId(userId, {
    status: "alive",
    ambitionLevel: { $gte: 68 },
    loyaltyScore: { $lte: 42 }
  })).sort({ ambitionLevel: -1 });

  const betrayer = pickRandom(candidates);
  if (!betrayer) {
    return null;
  }

  const boss = await Person.findOne({
    ...(userId && { userId }),
    faction: betrayer.faction,
    isBoss: true,
    status: "alive"
  });

  if (!boss || boss._id.toString() === betrayer._id.toString()) {
    return null;
  }

  betrayer.faction = "Independent";
  await recalibrateIndividual(
    userId,
    betrayer,
    {
      powerLevel: 70,
      influenceScore: 8,
      loyaltyScore: -10
    },
    `breaking away from ${boss.name}`
  );

  await Relationship.updateMany(
    withOptionalUserId(userId, {
      $or: [{ source: betrayer._id }, { target: betrayer._id }],
      type: { $in: ["command", "alliance"] }
    }),
    {
      $set: { status: "severed" }
    }
  );

  await Relationship.findOneAndUpdate(
    withOptionalUserId(userId, {
      source: boss._id,
      target: betrayer._id,
      type: "rivalry"
    }),
    {
      $set: {
        source: boss._id,
        target: betrayer._id,
        type: "rivalry",
        status: "active",
        ...(userId && { userId }),
        tensionScore: 92,
        details: `${betrayer.name} betrayed ${boss.name} and split from the organization.`
      },
      $inc: { weight: 2 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await createEvent(userId, {
    type: "betrayal",
    headline: `${betrayer.name} betrays ${boss.name}`,
    summary: `${betrayer.name} broke rank and turned independent, destabilizing ${boss.faction}.`,
    actor: betrayer._id,
    target: boss._id,
    faction: boss.faction,
    metadata: { loyaltyScore: betrayer.loyaltyScore, ambitionLevel: betrayer.ambitionLevel }
  });

  await refreshDominanceScores([betrayer._id, boss._id]);
  return betrayer;
}

async function policeRaid(userId = null, { lethalBias = false } = {}) {
  const raidCandidates = await Person.find(withOptionalUserId(userId, {
    role: "criminal",
    status: "alive",
    isCulprit: { $ne: true }
  })).sort({ createdAt: -1 });
  const target = raidCandidates.sort((a, b) => vulnerabilityScore(b) - vulnerabilityScore(a))[0];
  if (!target) {
    return null;
  }

  const officer = await Person.findOne(withOptionalUserId(userId, {
    role: "police",
    status: "alive"
  })).sort({ integrityScore: -1, casesSolved: -1 });

  if (!officer) {
    return null;
  }

  const corruptShield = await Relationship.findOne(withOptionalUserId(userId, {
    type: "corruption",
    status: "active",
    $or: [
      { source: target._id, target: officer._id },
      { source: officer._id, target: target._id }
    ]
  }));

  if (corruptShield || officer.isCorrupt) {
    await recalibrateIndividual(
      userId,
      target,
      {
        powerLevel: 20,
        influenceScore: 4
      },
      "surviving a compromised raid"
    );
    await createEvent(userId, {
      type: "raid",
      headline: `${target.name} dodges a raid`,
      summary: `A raid was compromised by corruption, allowing ${target.name} to stay in play.`,
      actor: officer._id,
      target: target._id,
      faction: target.faction
    });
    return "shielded";
  }

  const protectedTarget =
    target.isBoss ||
    (target.dominanceScore || 0) >= 620 ||
    (target.powerLevel || 0) >= 720;
  const shouldKill =
    !protectedTarget &&
    (lethalBias || target.powerLevel <= 180 || target.loyaltyScore <= 18 || vulnerabilityScore(target) >= 150);
  if (shouldKill) {
    await markPersonDead(target, {
      type: "elimination",
      headline: `${officer.name} erases ${target.name}`,
      summary: `${officer.name} turned a raid into a final blow, removing ${target.name} from the board.`,
      actor: officer._id,
      faction: target.faction,
      metadata: { aiKill: true, source: "raid" }
    }, userId);
    officer.casesSolved += 1;
    await officer.save();
    await recalibrateIndividual(
      userId,
      officer,
      {
        powerLevel: 16,
        influenceScore: 7,
        fearFactor: 5
      },
      `erasing ${target.name}`
    );
    await refreshDominanceScores([target._id, officer._id]);
    return "killed";
  }

  officer.casesSolved += 1;
  officer.encounters = (officer.encounters || 0) + 1;
  await officer.save();
  await recalibrateIndividual(
    userId,
    target,
    {
      powerLevel: -90,
      influenceScore: -10,
      fearFactor: -6
    },
    `being hit by ${officer.name}`
  );
  await recalibrateIndividual(
    userId,
    officer,
    {
      powerLevel: 8,
      influenceScore: 4
    },
    `cracking down on ${target.name}`
  );

  await createEvent(userId, {
    type: "raid",
    headline: `${officer.name} cracks down on ${target.name}`,
    summary: `${officer.name} disrupted ${target.name}'s operations and fractured part of the power structure.`,
    actor: officer._id,
    target: target._id,
    faction: target.faction
  });

  await refreshDominanceScores([target._id, officer._id]);
  return "hit";
}

async function createProceduralCrime(userId = null) {
  const { User } = require("./models");
  const user = userId ? await User.findById(userId) : null;
  const culprit =
    user?.culpritPersonId
      ? await Person.findOne({ _id: user.culpritPersonId, userId, status: "alive" })
      : null;
  const criminals = await Person.find(withOptionalUserId(userId, {
    role: "criminal",
    status: "alive"
  })).sort({ powerLevel: -1, ambitionLevel: -1 });

  const primary = culprit && Math.random() > 0.45 ? culprit : pickRandom(criminals.slice(0, 5));
  if (!primary) {
    return null;
  }

  const accomplices = criminals
    .filter((person) => person._id.toString() !== primary._id.toString())
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.random() > 0.55 ? 1 : 0);
  const suspects = [primary, ...accomplices];
  const template = pickRandom(proceduralCrimeCatalog);
  const district = primary.clueProfile?.district || pickRandom(cityDistricts);

  const crime = await Crime.create({
    userId,
    crimeId: nextCrimeId(),
    title: template.title,
    category: template.category,
    status: Math.random() > 0.45 ? "open" : "investigating",
    committedBy: suspects.map((person) => person._id),
    occurredAt: new Date(),
    district,
    evidence: "Fragments of surveillance, local chatter, and partial transaction records.",
    summary: template.summary
  });

  await Promise.all(
    suspects.map(async (person) => {
      person.cases = (person.cases || 0) + 1;
      person.money = (person.money || 0) + randomInt(40000, 220000);
      person.crimesCommitted = [...(person.crimesCommitted || []), template.category].slice(-8);
      if (template.violent) {
        person.murders = (person.murders || 0) + 1;
      }
      await person.save();
      await recalibrateIndividual(
        userId,
        person,
        {
          powerLevel: template.violent ? 16 : 10,
          influenceScore: 4,
          fearFactor: template.violent ? 8 : 3
        },
        `the ${crime.title} operation`
      );
    })
  );

  await createEvent(userId, {
    type: "crime",
    headline: `${crime.title} opens a new case`,
    summary: `${suspects.map((person) => person.name).join(", ")} triggered a ${crime.category.toLowerCase()} case in ${district}. Feed clue: the scene points toward ${primary.clueProfile?.method || "a practiced hand"}.`,
    actor: primary._id,
    target: accomplices[0]?._id,
    faction: primary.faction,
    metadata: { crimeId: crime.crimeId, district, category: crime.category, culpritSignal: Boolean(primary.isCulprit) }
  });

  await refreshDominanceScores(suspects.map((person) => person._id));
  return crime;
}

async function solvePendingCase(userId = null) {
  const { User } = require("./models");
  const user = userId ? await User.findById(userId) : null;
  const pendingCrime = await Crime.findOne(withOptionalUserId(userId, {
    status: { $in: ["open", "investigating"] }
  }))
    .populate("committedBy")
    .sort({ occurredAt: 1 });

  if (!pendingCrime) {
    return null;
  }

  const officer = await Person.findOne(withOptionalUserId(userId, {
    role: "police",
    status: "alive"
  })).sort({ casesSolved: -1, integrityScore: -1, intelligenceLevel: -1 });

  if (!officer) {
    return null;
  }

  pendingCrime.status = "solved";
  pendingCrime.solvedBy = officer._id;
  pendingCrime.evidence = `${pendingCrime.evidence || "Collected evidence"}; final warrants executed successfully.`;
  await pendingCrime.save();

  officer.cases = (officer.cases || 0) + 1;
  officer.casesSolved = (officer.casesSolved || 0) + 1;
  officer.encounters = (officer.encounters || 0) + 1;
  await officer.save();

  await recalibrateIndividual(
    userId,
    officer,
    {
      powerLevel: 10,
      influenceScore: 6,
      fearFactor: 2
    },
    `closing case ${pendingCrime.crimeId}`
  );

  await Promise.all(
    (pendingCrime.committedBy || []).map(async (criminal) => {
      const person = await Person.findById(criminal._id);
      if (!person || person.status === "dead") {
        return;
      }
      await recalibrateIndividual(
        userId,
        person,
        {
          powerLevel: -12,
          influenceScore: -6,
          fearFactor: -4,
          loyaltyScore: -2
        },
        `the fallout from case ${pendingCrime.crimeId}`
      );
    })
  );

  await createEvent(userId, {
    type: "investigation",
    headline: `${officer.name} closes ${pendingCrime.crimeId}`,
    summary: `${officer.name} solved ${pendingCrime.title} and forced the case ledger in the city's favor.${user?.culpritPersonId && pendingCrime.committedBy?.some((person) => person._id.toString() === user.culpritPersonId.toString()) ? " The case file mentions the same signature seen in earlier clue drops." : ""}`,
    actor: officer._id,
    target: pendingCrime.committedBy?.[0]?._id,
    faction: officer.faction,
    metadata: { crimeId: pendingCrime.crimeId, title: pendingCrime.title }
  });

  return pendingCrime;
}

async function populationPressureKill(userId = null, balance) {
  const candidates = await Person.find(withOptionalUserId(userId, {
    status: "alive",
    role: "criminal",
    isBoss: false,
    isCulprit: { $ne: true }
  })).sort({ isOutsider: -1, createdAt: -1, loyaltyScore: 1, powerLevel: 1 });

  const target = candidates[0];
  if (!target) {
    return null;
  }

  const rivalry = await Relationship.findOne(withOptionalUserId(userId, {
    type: "rivalry",
    status: "active",
    $or: [{ source: target._id }, { target: target._id }]
  })).populate("source target");

  const killer =
    (rivalry && rivalry.source._id.toString() === target._id.toString() ? rivalry.target : rivalry?.source) ||
    (await Person.findOne(withOptionalUserId(userId, { role: "police", status: "alive" })).sort({ integrityScore: -1, casesSolved: -1 }));

  await markPersonDead(target, {
    type: killer ? "assassination" : "elimination",
    headline: `${target.name} is swallowed by the city`,
    summary: `${target.name} was removed as the underworld corrected its own overcrowding. New blood had outpaced the city's appetite, and ${target.name} was the next sacrifice.`,
    actor: killer?._id,
    faction: target.faction,
    metadata: { aiKill: true, source: "population-pressure", surplusBeforeKill: balance.surplus }
  }, userId);

  if (killer) {
    await recalibrateIndividual(
      userId,
      killer,
      {
        powerLevel: 25,
        influenceScore: 5,
        fearFactor: 6
      },
      `surviving the city's population squeeze`
    );
    await refreshDominanceScores([killer._id, target._id]);
  } else {
    await refreshDominanceScores([target._id]);
  }

  return target;
}

async function increaseTension(userId = null) {
  const activeRelationships = await Relationship.find(withOptionalUserId(userId, {
    status: "active",
    type: { $in: ["alliance", "transaction", "rivalry", "corruption"] }
  }));

  await Promise.all(
    activeRelationships.map(async (relationship) => {
      const delta = relationship.type === "rivalry" ? 8 : Math.random() > 0.7 ? 5 : -2;
      relationship.tensionScore = clamp(relationship.tensionScore + delta, 0, 100);
      if (relationship.tensionScore >= 78 && relationship.type === "alliance") {
        relationship.type = "rivalry";
        relationship.details = "Alliance collapsed under rising tension.";
      }
      await relationship.save();
    })
  );
}

async function runSimulationTick(userIdOrReason = "auto", maybeReason = null) {
  const userId = maybeReason === null ? null : userIdOrReason;
  const reason = maybeReason === null ? userIdOrReason : maybeReason;

  if (userId) {
    await ensureCulpritForUser(userId);
  }

  await hydrateLoreProfiles();
  await refreshDominanceScores(null, userId);
  await increaseTension(userId);

  const [criminalCount, unsolvedCaseCount] = await Promise.all([
    Person.countDocuments(withOptionalUserId(userId, { role: "criminal", status: "alive", isInWorld: { $ne: false } })),
    Crime.countDocuments(withOptionalUserId(userId, { status: { $in: ["open", "investigating"] } }))
  ]);
  let balance = await getPopulationBalance(userId);
  let eventType = "simulation";
  let outcome = null;

  if (balance.surplus >= simulationState.populationPressureThreshold) {
    outcome =
      (await populationPressureKill(userId, balance)) ||
      (await assassinationAttempt(userId)) ||
      (await policeRaid(userId, { lethalBias: true })) ||
      (await solvePendingCase(userId));
    eventType = outcome ? "population-pressure-kill" : "simulation";
  } else {
    const roll = Math.random();
    const creationThreshold = criminalCount < 12 ? 0.32 : 0.18;
    const newCaseThreshold = unsolvedCaseCount < 3 ? creationThreshold + 0.24 : creationThreshold + 0.18;
    const solveCaseThreshold = newCaseThreshold + 0.14;
    const betrayalThreshold = solveCaseThreshold + 0.14;
    const assassinationThreshold = betrayalThreshold + 0.14;
    const raidThreshold = assassinationThreshold + 0.12;

    if (roll < creationThreshold && balance.surplus < simulationState.populationPressureThreshold - 1) {
      outcome = await generateEmergentCharacter(userId);
      eventType = outcome ? "emergence" : "simulation";
    } else if (roll < newCaseThreshold) {
      outcome = await createProceduralCrime(userId);
      eventType = outcome ? "crime" : "simulation";
    } else if (roll < solveCaseThreshold) {
      outcome = await solvePendingCase(userId);
      eventType = outcome ? "investigation" : "simulation";
    } else if (roll < betrayalThreshold) {
      outcome = await betrayalEvent(userId);
      eventType = outcome ? "betrayal" : "simulation";
    } else if (roll < assassinationThreshold) {
      outcome = await assassinationAttempt(userId);
      eventType = outcome ? "assassination" : "simulation";
    } else if (roll < raidThreshold) {
      outcome = await policeRaid(userId, { lethalBias: balance.pressure === "rising" });
      eventType = outcome ? "raid" : "simulation";
    } else {
      outcome = await outsiderRise(userId);
      eventType = outcome ? "outsider-rise" : "simulation";
    }
  }

  if (!outcome) {
    await createEvent(userId, {
      type: "simulation",
      headline: "Power recalibrates",
      summary: "The city shifted in silence this cycle, but the balance of fear and ambition kept moving.",
      metadata: { reason, fallback: true }
    });
  } else if (eventType === "simulation") {
    await createEvent(userId, {
      type: "simulation",
      headline: "Power recalibrates",
      summary: "Whispers, tribute, and fear reshaped the underworld without a public flashpoint.",
      metadata: { reason }
    });
  }

  if (userId && Math.random() < 0.6) {
    await dropCulpritClue(userId);
  }

  balance = await getPopulationBalance(userId);
  simulationState.lastTickAt = new Date();
  return {
    lastTickAt: simulationState.lastTickAt,
    eventType,
    isRunning: simulationState.isRunning,
    population: balance
  };
}

function startSimulation(onTick) {
  if (simulationState.timer) {
    clearInterval(simulationState.timer);
  }

  simulationState.isRunning = true;
  simulationState.timer = setInterval(async () => {
    if (!simulationState.isRunning) {
      return;
    }
    await onTick();
  }, simulationState.intervalMs);
}

function setSimulationRunning(value) {
  simulationState.isRunning = Boolean(value);
  return simulationState;
}

async function getSimulationState(userId = null) {
  return {
    isRunning: simulationState.isRunning,
    intervalMs: simulationState.intervalMs,
    lastTickAt: simulationState.lastTickAt,
    population: await getPopulationBalance(userId),
    narrativeMode: "local-only"
  };
}

async function ensureCulpritForUser(userId) {
  const { User } = require("./models");
  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  if (user.culpritPersonId) {
    const existing = await Person.findOne({ _id: user.culpritPersonId, userId });
    if (existing?.status === "alive") {
      return existing;
    }
  }

  const profile = backgroundProfiles.balanced;
  const culprit = await Person.create({
    userId,
      name: await uniqueGeneratedName(userId),
    alias: pickRandom(aliases),
    role: "criminal",
    faction: "Independent",
    rank: "Fixer",
    money: randomInt(profile.money[0], profile.money[1]),
    cases: randomInt(1, 3),
    crimesCommitted: ["Conspiracy"],
    murders: randomInt(0, 2),
    influenceScore: randomInt(44, 72),
    powerLevel: randomInt(310, 620),
    loyaltyScore: randomInt(28, 61),
    ambitionLevel: randomInt(68, 96),
    fearFactor: randomInt(38, 82),
    intelligenceLevel: randomInt(64, 92),
    isInWorld: false,
    isOutsider: Math.random() > 0.65,
    isCulprit: true,
    clueProfile: {
      district: pickRandom(cityDistricts),
      method: pickRandom(culpritMethods),
      tell: pickRandom(culpritTells),
      trait: pickRandom(culpritTraits)
    },
    weaknessTags: pickWeaknesses(),
    backgroundTier: "balanced",
    backgroundSummary: "A hidden culprit seeded into the city but still operating beyond the visible network.",
    backstory: "This operator entered the city with enough connections to stay useful and enough caution to avoid early suspicion."
  });

  user.culpritPersonId = culprit._id;
  user.culpritClueStage = 0;
  user.culpritGuessCount = 0;
  user.culpritSolved = false;
  user.culpritRevealedName = null;
  await user.save();

  return culprit;
}

async function surfaceCulpritInWorld(userId, culprit) {
  if (!culprit || culprit.isInWorld !== false) {
    return culprit;
  }

  culprit.isInWorld = true;
  await culprit.save();

  const anchor = await Person.findOne({
    userId,
    role: "criminal",
    status: "alive",
    isInWorld: { $ne: false },
    _id: { $ne: culprit._id }
  }).sort({ influenceScore: -1, powerLevel: -1 });

  if (anchor) {
    const existingLink = await Relationship.findOne({
      userId,
      $or: [
        { source: culprit._id, target: anchor._id },
        { source: anchor._id, target: culprit._id }
      ]
    });

    if (!existingLink) {
      await Relationship.create({
        userId,
        source: culprit._id,
        target: anchor._id,
        type: Math.random() > 0.45 ? "alliance" : "transaction",
        weight: 2,
        tensionScore: 34,
        details: `${culprit.name} surfaced inside ${anchor.name}'s orbit after staying dark through the early clue trail.`
      });
    }
  }

  return culprit;
}

async function dropCulpritClue(userId) {
  const { User } = require("./models");
  const user = await User.findById(userId);
  if (!user?.culpritPersonId || user.culpritSolved || (user.culpritGuessCount || 0) >= 3) {
    return null;
  }

  let culprit = await Person.findOne({ _id: user.culpritPersonId, userId, status: "alive" });
  if (!culprit) {
    return null;
  }

  const clueStage = user.culpritClueStage || 0;
  if (culprit.isInWorld === false && clueStage >= 1) {
    culprit = await surfaceCulpritInWorld(userId, culprit);
  }
  const clueLines = [
    `Witness chatter points to someone operating around ${culprit.clueProfile?.district}.`,
    `Forensics keep circling a method: ${culprit.clueProfile?.method}.`,
    `Street talk says the culprit ${culprit.clueProfile?.tell}.`,
    `Analysts believe the target profile matches ${culprit.clueProfile?.trait}.`
  ];

  const summary = clueLines[Math.min(clueStage, clueLines.length - 1)];
  user.culpritClueStage = clueStage + 1;
  await user.save();

  await createEvent(userId, {
    type: "investigation",
    headline: culprit.isInWorld === false ? "Hidden clue logged into the feed" : "Clue logged into the feed",
    summary,
    actor: culprit.isInWorld === false ? null : culprit._id,
    faction: culprit.faction,
    metadata: { culpritClue: true, clueStage, culpritSurfaced: culprit.isInWorld !== false }
  });

  return true;
}

async function guessCulprit(userId, suspectId) {
  const { User } = require("./models");
  const user = await User.findById(userId);
  if (!user?.culpritPersonId) {
    const error = new Error("No culprit game is active");
    error.status = 400;
    throw error;
  }

  if (user.culpritSolved) {
    return {
      correct: true,
      user: await buildSerializedUser(user),
      message: "You already identified the culprit."
    };
  }

  if ((user.culpritGuessCount || 0) >= 3) {
    return {
      correct: false,
      user: await buildSerializedUser(user),
      message: "All three guesses have already been used."
    };
  }

  const suspect = await Person.findOne({ _id: suspectId, userId, status: "alive", isInWorld: { $ne: false } });
  if (!suspect) {
    const error = new Error("Suspect not found");
    error.status = 404;
    throw error;
  }

  const culprit = await Person.findOne({ _id: user.culpritPersonId, userId });
  const isCorrect = culprit && culprit._id.toString() === suspect._id.toString();

  user.culpritGuessCount = (user.culpritGuessCount || 0) + 1;

  if (isCorrect) {
    user.culpritSolved = true;
    user.culpritRevealedName = culprit.name;
    await user.save();

    await createEvent(userId, {
      type: "investigation",
      headline: "Culprit identified",
      summary: `${suspect.name} matched the clue trail. The operator cracked the case before running out of guesses.`,
      actor: suspect._id,
      faction: suspect.faction,
      metadata: { culpritSolved: true }
    });

    return {
      correct: true,
      user: await buildSerializedUser(user),
      message: `${suspect.name} is the culprit. Case closed.`
    };
  }

  const attemptsRemaining = Math.max(0, 3 - user.culpritGuessCount);
  if (attemptsRemaining === 0) {
    user.culpritRevealedName = culprit?.name || null;
  }
  await user.save();

  await createEvent(userId, {
    type: "investigation",
    headline: attemptsRemaining === 0 ? "Final guess missed" : "Wrong suspect flagged",
    summary:
      attemptsRemaining === 0
        ? `${suspect.name} was not the culprit. The real culprit was ${culprit?.name || "never identified"} and the file is now locked.`
        : `${suspect.name} does not fit the clue trail. ${attemptsRemaining} guess${attemptsRemaining === 1 ? "" : "es"} remain.`,
    actor: suspect._id,
    target: culprit?._id,
    faction: suspect.faction,
    metadata: { culpritGuess: true, attemptsRemaining }
  });

  return {
    correct: false,
    user: await buildSerializedUser(user),
    message:
      attemptsRemaining === 0
        ? `${suspect.name} was wrong. The culprit was ${culprit?.name || "unknown"}.`
        : `${suspect.name} is not the culprit. ${attemptsRemaining} guess${attemptsRemaining === 1 ? "" : "es"} left.`
  };
}

async function restartCulpritGame(userId) {
  const { User, Person, Crime, Relationship, Event } = require("./models");
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (!user.culpritSolved && (user.culpritGuessCount || 0) < 3) {
    const error = new Error("Restart is only available after a solved or locked case");
    error.status = 400;
    throw error;
  }

  user.culpritPersonId = null;
  user.culpritClueStage = 0;
  user.culpritGuessCount = 0;
  user.culpritSolved = false;
  user.culpritRevealedName = null;
  await user.save();

  await Promise.all([
    Event.deleteMany({ userId }),
    Crime.deleteMany({ userId }),
    Relationship.deleteMany({ userId }),
    Person.deleteMany({ userId })
  ]);

  await createStarterWorld(userId);
  await ensureCulpritForUser(userId);

  const refreshedUser = await User.findById(userId);
  return {
    user: await buildSerializedUser(refreshedUser),
    message: "A fresh world is now active."
  };
}

function emitGraphRefresh(io, reason) {
  if (!io) {
    return;
  }
  setTimeout(async () => {
    try {
      io.emit("graph:refresh", { reason, timestamp: new Date() });
    } catch (error) {
      console.error("Failed to emit graph refresh", error);
    }
}, 50);
}

const JWT_SECRET = process.env.JWT_SECRET || "black-horizon-secret-key-change-in-production";

function buildSystemEmail(username) {
  return `operator+${String(username || "").trim()}@sin-city.local`;
}

function generateToken(user) {
  const jwt = require("jsonwebtoken");
  return jwt.sign(
    { userId: user._id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function serializeUser(user, culprit = null) {
  const attemptsRemaining = Math.max(0, 3 - (user.culpritGuessCount || 0));
  const culpritStatus = user.culpritSolved ? "solved" : attemptsRemaining === 0 ? "locked" : "active";
  return {
    _id: user._id,
    username: user.username,
    operatorName: user.operatorName || user.username,
    email: user.email,
    role: user.role,
    title: user.title || "Field Analyst",
    division: user.division || "Intelligence Unit",
      culpritGame: {
        status: culpritStatus,
        attemptsRemaining,
        guessesUsed: user.culpritGuessCount || 0,
        culpritRevealedName: user.culpritRevealedName || null,
        culpritInWorld: Boolean(culprit && culprit.status === "alive" && culprit.isInWorld !== false)
      }
    };
}

async function buildSerializedUser(user) {
  const culprit = user?.culpritPersonId ? await Person.findById(user.culpritPersonId).lean() : null;
  return serializeUser(user, culprit);
}

async function registerUser({ username, email, password }) {
  const { User } = require("./models");
  const normalizedUsername = String(username || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedUsername || normalizedUsername.length < 3) {
    const error = new Error("Username must be at least 3 characters");
    error.status = 400;
    throw error;
  }

  if (normalizedPassword.length < 6) {
    const error = new Error("Password must be at least 6 characters");
    error.status = 400;
    throw error;
  }
  
  const existingUser = await User.findOne({ username: normalizedUsername });
  if (existingUser) {
    const error = new Error("Username already exists");
    error.status = 400;
    throw error;
  }

  const resolvedEmail =
    typeof email === "string" && email.trim()
      ? email.trim()
      : buildSystemEmail(normalizedUsername);

  const user = await User.create({
    username: normalizedUsername,
    email: resolvedEmail,
    password: normalizedPassword
  });
  const token = generateToken(user);
  
  // Initialize starter world for new user
  await createStarterWorld(user._id);
  await ensureCulpritForUser(user._id);

  return {
    user: await buildSerializedUser(user),
    token
  };
}

async function loginUser({ username, password }) {
  const { User } = require("./models");
  const normalizedUsername = String(username || "").trim();
  
  const user = await User.findOne({ username: normalizedUsername });
  if (!user) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  if (!user.comparePassword(password)) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  user.lastLogin = new Date();
  await user.save();
  await ensureCulpritForUser(user._id);

  const token = generateToken(user);

  return {
    user: await buildSerializedUser(user),
    token
  };
}

async function getCurrentUser(userId) {
  const { User } = require("./models");
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }
  return buildSerializedUser(user);
}

async function updateCurrentUser(userId, payload) {
  const { User } = require("./models");
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (typeof payload.operatorName === "string") {
    user.operatorName = payload.operatorName.trim() || user.username;
  }

  if (typeof payload.title === "string") {
    user.title = payload.title.trim() || "Field Analyst";
  }

  if (typeof payload.division === "string") {
    user.division = payload.division.trim() || "Intelligence Unit";
  }

  await user.save();
  return buildSerializedUser(user);
}

function authenticateToken(req, res, next) {
  const jwt = require("jsonwebtoken");
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error = new Error("No token provided");
    error.status = 401;
    return next(error);
  }

  const token = authHeader.split(" ")[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    const err = new Error("Invalid token");
    err.status = 401;
    next(err);
  }
}

async function createStarterWorld(userId) {
  const { Person, Crime, Relationship, Event } = require("./models");

  const people = await Person.insertMany([
    {
      name: "Marcus Vale",
      alias: "The Shadow",
      role: "criminal",
      faction: "Vale Syndicate",
      rank: "Boss",
      money: 5000000,
      powerLevel: 850,
      loyaltyScore: 90,
      ambitionLevel: 60,
      fearFactor: 92,
      intelligenceLevel: 85,
      influenceScore: 95,
      isBoss: true,
      status: "alive",
      weaknessTags: ["ego"],
      userId,
      backgroundTier: "powerful",
      backgroundSummary: "A ruthless crime lord who built an empire from the shadows.",
      backstory: "Marcus Vale rose from nothing to control half the city's underworld."
    },
    {
      name: "Diana Chen",
      alias: "Ice Queen",
      role: "criminal",
      faction: "Vale Syndicate",
      rank: "Underboss",
      money: 1800000,
      powerLevel: 680,
      loyaltyScore: 85,
      ambitionLevel: 75,
      fearFactor: 70,
      intelligenceLevel: 90,
      influenceScore: 78,
      status: "alive",
      weaknessTags: ["loyalty conflict"],
      userId,
      backgroundTier: "balanced",
      backgroundSummary: "Strategic and calculating, Diana is Marcus's right hand."
    },
    {
      name: "Rex Nolan",
      alias: "Trigger",
      role: "criminal",
      faction: "Vale Syndicate",
      rank: "Lieutenant",
      money: 450000,
      powerLevel: 450,
      loyaltyScore: 55,
      ambitionLevel: 85,
      fearFactor: 88,
      intelligenceLevel: 65,
      influenceScore: 52,
      status: "alive",
      weaknessTags: ["greed"],
      userId,
      backgroundTier: "balanced",
      backgroundSummary: "A violent enforcer known for extreme methods."
    },
    {
      name: "Captain Sarah Blake",
      role: "police",
      faction: "City PD",
      rank: "Captain",
      cases: 18,
      casesSolved: 14,
      powerLevel: 420,
      loyaltyScore: 88,
      fearFactor: 55,
      intelligenceLevel: 80,
      integrityScore: 85,
      status: "alive",
      weaknessTags: [],
      userId
    },
    {
      name: "Detective Mike Ross",
      role: "police",
      faction: "City PD",
      rank: "Detective",
      cases: 12,
      casesSolved: 8,
      powerLevel: 320,
      loyaltyScore: 45,
      fearFactor: 40,
      intelligenceLevel: 72,
      integrityScore: 35,
      isCorrupt: true,
      status: "alive",
      weaknessTags: ["greed"],
      userId
    }
  ]);

  const lookup = Object.fromEntries(people.map(p => [p.name, p]));

  await Relationship.insertMany([
    {
      source: lookup["Marcus Vale"]._id,
      target: lookup["Diana Chen"]._id,
      type: "command",
      weight: 5,
      tensionScore: 25,
      userId
    },
    {
      source: lookup["Marcus Vale"]._id,
      target: lookup["Rex Nolan"]._id,
      type: "command",
      weight: 3,
      tensionScore: 45,
      userId
    },
    {
      source: lookup["Diana Chen"]._id,
      target: lookup["Rex Nolan"]._id,
      type: "alliance",
      weight: 2,
      tensionScore: 55,
      userId
    },
    {
      source: lookup["Captain Sarah Blake"]._id,
      target: lookup["Detective Mike Ross"]._id,
      type: "official",
      weight: 2,
      tensionScore: 15,
      userId
    },
    {
      source: lookup["Detective Mike Ross"]._id,
      target: lookup["Marcus Vale"]._id,
      type: "corruption",
      weight: 4,
      tensionScore: 70,
      userId
    }
  ]);

  const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
  await Crime.insertMany([
    {
      crimeId: `BH-${shortId}`,
      title: "Harbor Heist",
      category: "Theft",
      status: "investigating",
      committedBy: [lookup["Marcus Vale"]._id, lookup["Rex Nolan"]._id],
      occurredAt: new Date(),
      district: "Harbor District",
      summary: "Major weapons shipment stolen from the docks.",
      userId
    }
  ]);

  await Event.insertMany([
    {
      type: "simulation",
      headline: "The city awakens",
      summary: "Your new empire begins. The underworld awaits your command.",
      actor: lookup["Marcus Vale"]._id,
      faction: "Vale Syndicate",
      userId
    }
  ]);

  return { people, relationships: await Relationship.find({ userId }), crimes: await Crime.find({ userId }) };
}

// Add userId to all queries
function withUserId(query) {
  return { ...query, userId: null };
}

module.exports = {
  connectDB,
  asyncHandler,
  calculateDominance,
  refreshDominanceScores,
  successorScore,
  listPeople,
  createPerson,
  updatePerson,
  deletePerson,
  listCrimes,
  createCrime,
  updateCrime,
  listRelationships,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  getDashboardGraph,
  runRelationshipAnalysis,
  createEvent,
  listEvents,
  handleSuccession,
  hydrateLoreProfiles,
  generateEmergentCharacter,
  runSimulationTick,
  startSimulation,
  setSimulationRunning,
  getSimulationState,
  emitGraphRefresh,
  guessCulprit,
  restartCulpritGame,
  registerUser,
  loginUser,
  getCurrentUser,
  updateCurrentUser,
  authenticateToken
};
