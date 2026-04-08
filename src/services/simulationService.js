const Person = require("../models/Person");
const Relationship = require("../models/Relationship");
const Event = require("../models/Event");
const { successorScore, refreshDominanceScores } = require("./powerService");

const simulationState = {
  isRunning: true,
  intervalMs: 18000,
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

async function uniqueGeneratedName() {
  let attempts = 0;
  while (attempts < 10) {
    const name = `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
    const existing = await Person.exists({ name });
    if (!existing) {
      return name;
    }
    attempts += 1;
  }
  return `Ghost ${Date.now().toString().slice(-4)}`;
}

async function createEvent(payload) {
  return Event.create(payload);
}

async function listEvents(limit = 25) {
  return Event.find().populate("actor target").sort({ happenedAt: -1 }).limit(limit).lean();
}

async function getPopulationBalance() {
  const [generatedCount, killCount, aliveCount, deadCount] = await Promise.all([
    Event.countDocuments({
      $or: [{ type: "emergence" }, { "metadata.generated": true }]
    }),
    Event.countDocuments({
      $or: [{ type: "assassination" }, { type: "elimination" }]
    }),
    Person.countDocuments({ status: "alive" }),
    Person.countDocuments({ status: "dead" })
  ]);

  const surplus = generatedCount - killCount;
  const pressure =
    surplus >= simulationState.populationPressureThreshold
      ? "high"
      : surplus >= Math.max(1, simulationState.populationPressureThreshold - 1)
        ? "rising"
        : "stable";

  return {
    generatedCount,
    killCount,
    aliveCount,
    deadCount,
    surplus,
    pressure,
    threshold: simulationState.populationPressureThreshold
  };
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

async function handleSuccession(deadBoss) {
  const candidates = await Person.find({
    _id: { $in: deadBoss.heirCandidates || [] },
    status: "alive"
  });

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => successorScore(b) - successorScore(a));
  const successor = candidates[0];

  await Person.updateMany({ faction: deadBoss.faction, isBoss: true }, { $set: { isBoss: false } });
  successor.isBoss = true;
  successor.rank = "Boss";
  successor.powerLevel = clamp(successor.powerLevel + 180, 0, 1000);
  successor.fearFactor = clamp(successor.fearFactor + 22, 0, 100);
  successor.influenceScore = clamp(successor.influenceScore + 15, 0, 100);
  successor.loyaltyScore = clamp(successor.loyaltyScore + 12, 0, 100);
  await successor.save();

  const defectors = await Person.find({
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
        {
          $or: [{ source: person._id }, { target: person._id }],
          type: "command"
        },
        {
          $set: {
            status: "severed"
          }
        }
      );
    })
  );

  await createEvent({
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

async function markPersonDead(person, eventPayload) {
  if (!person || person.status === "dead") {
    return false;
  }

  person.status = "dead";
  person.powerLevel = 0;
  person.fearFactor = 0;
  person.loyaltyScore = 0;
  await person.save();

  await Relationship.updateMany(
    {
      $or: [{ source: person._id }, { target: person._id }]
    },
    {
      $set: { status: "weakening" }
    }
  );

  await createEvent({
    type: eventPayload.type || "elimination",
    headline: eventPayload.headline,
    summary: eventPayload.summary,
    actor: eventPayload.actor,
    target: person._id,
    faction: eventPayload.faction || person.faction,
    metadata: eventPayload.metadata || {}
  });

  if (person.isBoss) {
    await handleSuccession(person);
  }

  return true;
}

async function assassinationAttempt() {
  const rivalries = await Relationship.find({
    type: "rivalry",
    tensionScore: { $gte: 65 },
    status: "active"
  }).populate("source target");

  const rivalryCandidates = rivalries
    .filter((link) => link.source?.status === "alive" && link.target?.status === "alive")
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
      metadata: {
        tensionScore: rivalry.tensionScore,
        aiKill: true
      }
    });

    await refreshDominanceScores([attacker._id, target._id]);
    return true;
  }

  rivalry.tensionScore = clamp(rivalry.tensionScore + (protectedTarget ? 8 : 12), 0, 100);
  await rivalry.save();
  return false;
}

async function outsiderRise() {
  const outsiders = await Person.find({
    isOutsider: true,
    status: "alive"
  });

  const outsider = pickRandom(outsiders);
  if (!outsider) {
    return null;
  }

  const weakTargets = await Person.find({
    status: "alive",
    _id: { $ne: outsider._id },
    $or: [{ loyaltyScore: { $lt: 45 } }, { powerLevel: { $lt: 260 } }]
  }).sort({ loyaltyScore: 1, powerLevel: 1 });

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

  outsider.powerLevel = clamp(outsider.powerLevel + 45, 0, 1000);
  outsider.influenceScore = clamp(outsider.influenceScore + 6, 0, 100);
  await outsider.save();

  target.loyaltyScore = clamp(target.loyaltyScore - 12, 0, 100);
  target.ambitionLevel = clamp(target.ambitionLevel + 8, 0, 100);
  await target.save();

  await Relationship.findOneAndUpdate(
    {
      source: outsider._id,
      target: target._id,
      type: "alliance"
    },
    {
      $set: {
        source: outsider._id,
        target: target._id,
        type: "alliance",
        status: "active",
        details: `${outsider.name} exploited ${target.name}'s ${exploitTag} weakness.`,
        tensionScore: 28
      },
      $inc: {
        weight: 1
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  await createEvent({
    type: "alliance",
    headline: `${outsider.name} gains ground`,
    summary: `${outsider.name} used ${exploitTag} tactics against ${target.name}, turning weakness into influence.`,
    actor: outsider._id,
    target: target._id,
    faction: outsider.faction,
    metadata: {
      exploitTag
    }
  });

  await refreshDominanceScores([outsider._id, target._id]);
  return outsider;
}

async function generateEmergentCharacter() {
  const balance = await getPopulationBalance();
  if (balance.surplus >= simulationState.populationPressureThreshold) {
    return null;
  }

  const factions = await Person.aggregate([
    {
      $match: {
        role: "criminal",
        status: "alive"
      }
    },
    {
      $group: {
        _id: "$faction",
        count: { $sum: 1 },
        avgLoyalty: { $avg: "$loyaltyScore" }
      }
    },
    {
      $sort: {
        avgLoyalty: 1,
        count: 1
      }
    }
  ]);

  const targetFaction = factions[0]?._id || "Outlands";
  const name = await uniqueGeneratedName();
  const isOutsider = Math.random() > 0.45;
  const backgroundTier = pickRandom(["powerful", "balanced", "weak"]);
  const profile = backgroundProfiles[backgroundTier];
  const role = Math.random() > 0.82 ? "police" : "criminal";
  const alias = pickRandom(aliases);

  const person = await Person.create({
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

  const lore = buildCharacterLore(person, backgroundTier);
  person.backgroundTier = lore.backgroundTier;
  person.backgroundSummary = lore.backgroundSummary;
  person.backstory = lore.backstory;
  person.notes = isOutsider
    ? "AI-generated operator seeking a foothold in the city."
    : "AI-generated climber inserted into a shaky faction.";
  await person.save();

  const anchor = await Person.findOne({
    faction: person.faction,
    status: "alive",
    _id: { $ne: person._id }
  }).sort({ dominanceScore: -1 });

  if (anchor) {
    await Relationship.create({
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

  await createEvent({
    type: "emergence",
    headline: `${person.name} enters the board`,
    summary: `${person.name}, known as ${person.alias}, arrived with a ${backgroundTier} background and ${person.powerLevel} power.`,
    actor: person._id,
    target: anchor?._id,
    faction: person.faction,
    metadata: {
      generated: true,
      isOutsider,
      backgroundTier
    }
  });

  await refreshDominanceScores([person._id, anchor?._id].filter(Boolean));
  return person;
}

async function betrayalEvent() {
  const candidates = await Person.find({
    status: "alive",
    ambitionLevel: { $gte: 68 },
    loyaltyScore: { $lte: 42 }
  }).sort({ ambitionLevel: -1 });

  const betrayer = pickRandom(candidates);
  if (!betrayer) {
    return null;
  }

  const boss = await Person.findOne({
    faction: betrayer.faction,
    isBoss: true,
    status: "alive"
  });

  if (!boss || boss._id.toString() === betrayer._id.toString()) {
    return null;
  }

  betrayer.faction = "Independent";
  betrayer.powerLevel = clamp(betrayer.powerLevel + 70, 0, 1000);
  betrayer.influenceScore = clamp(betrayer.influenceScore + 8, 0, 100);
  await betrayer.save();

  await Relationship.updateMany(
    {
      $or: [{ source: betrayer._id }, { target: betrayer._id }],
      type: { $in: ["command", "alliance"] }
    },
    {
      $set: { status: "severed" }
    }
  );

  await Relationship.findOneAndUpdate(
    {
      source: boss._id,
      target: betrayer._id,
      type: "rivalry"
    },
    {
      $set: {
        source: boss._id,
        target: betrayer._id,
        type: "rivalry",
        status: "active",
        tensionScore: 92,
        details: `${betrayer.name} betrayed ${boss.name} and split from the organization.`
      },
      $inc: { weight: 2 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await createEvent({
    type: "betrayal",
    headline: `${betrayer.name} betrays ${boss.name}`,
    summary: `${betrayer.name} broke rank and turned independent, destabilizing ${boss.faction}.`,
    actor: betrayer._id,
    target: boss._id,
    faction: boss.faction,
    metadata: {
      loyaltyScore: betrayer.loyaltyScore,
      ambitionLevel: betrayer.ambitionLevel
    }
  });

  await refreshDominanceScores([betrayer._id, boss._id]);
  return betrayer;
}

async function policeRaid({ lethalBias = false } = {}) {
  const raidCandidates = await Person.find({
    role: "criminal",
    status: "alive"
  }).sort({ createdAt: -1 });
  const target = raidCandidates.sort((a, b) => vulnerabilityScore(b) - vulnerabilityScore(a))[0];
  if (!target) {
    return null;
  }

  const officer = await Person.findOne({
    role: "police",
    status: "alive"
  }).sort({ integrityScore: -1, casesSolved: -1 });

  if (!officer) {
    return null;
  }

  const corruptShield = await Relationship.findOne({
    type: "corruption",
    status: "active",
    $or: [
      { source: target._id, target: officer._id },
      { source: officer._id, target: target._id }
    ]
  });

  if (corruptShield || officer.isCorrupt) {
    target.powerLevel = clamp(target.powerLevel + 20, 0, 1000);
    await target.save();
    await createEvent({
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
      metadata: {
        aiKill: true,
        source: "raid"
      }
    });
    officer.casesSolved += 1;
    await officer.save();
    await refreshDominanceScores([target._id, officer._id]);
    return "killed";
  }

  target.powerLevel = clamp(target.powerLevel - 90, 0, 1000);
  target.influenceScore = clamp(target.influenceScore - 10, 0, 100);
  officer.casesSolved += 1;
  await Promise.all([target.save(), officer.save()]);

  await createEvent({
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

async function populationPressureKill(balance) {
  const candidates = await Person.find({
    status: "alive",
    role: "criminal",
    isBoss: false
  }).sort({ isOutsider: -1, createdAt: -1, loyaltyScore: 1, powerLevel: 1 });

  const target = candidates[0];
  if (!target) {
    return null;
  }

  const rivalry = await Relationship.findOne({
    type: "rivalry",
    status: "active",
    $or: [{ source: target._id }, { target: target._id }]
  }).populate("source target");

  const killer =
    (rivalry && rivalry.source._id.toString() === target._id.toString() ? rivalry.target : rivalry?.source) ||
    (await Person.findOne({ role: "police", status: "alive" }).sort({ integrityScore: -1, casesSolved: -1 }));

  await markPersonDead(target, {
    type: killer ? "assassination" : "elimination",
    headline: `${target.name} is swallowed by the city`,
    summary: `${target.name} was removed as the underworld corrected its own overcrowding. New blood had outpaced the city’s appetite, and ${target.name} was the next sacrifice.`,
    actor: killer?._id,
    faction: target.faction,
    metadata: {
      aiKill: true,
      source: "population-pressure",
      surplusBeforeKill: balance.surplus
    }
  });

  if (killer) {
    killer.powerLevel = clamp(killer.powerLevel + 25, 0, 1000);
    await killer.save();
    await refreshDominanceScores([killer._id, target._id]);
  } else {
    await refreshDominanceScores([target._id]);
  }

  return target;
}

async function increaseTension() {
  const activeRelationships = await Relationship.find({
    status: "active",
    type: { $in: ["alliance", "transaction", "rivalry", "corruption"] }
  });

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

async function runSimulationTick(reason = "auto") {
  await hydrateLoreProfiles();
  await refreshDominanceScores();
  await increaseTension();

  let balance = await getPopulationBalance();
  let eventType = "simulation";

  if (balance.surplus >= simulationState.populationPressureThreshold) {
    const killed = (await populationPressureKill(balance)) || (await assassinationAttempt()) || (await policeRaid({ lethalBias: true }));
    eventType = killed ? "population-pressure-kill" : "assassination";
  } else {
    const roll = Math.random();
    if (roll < 0.2) {
      await outsiderRise();
      eventType = "outsider-rise";
    } else if (roll < 0.3 && balance.surplus < simulationState.populationPressureThreshold - 1) {
      await generateEmergentCharacter();
      eventType = "emergence";
    } else if (roll < 0.45) {
      await betrayalEvent();
      eventType = "betrayal";
    } else if (roll < 0.68) {
      await assassinationAttempt();
      eventType = "assassination";
    } else if (roll < 0.88) {
      await policeRaid({ lethalBias: balance.pressure === "rising" });
      eventType = "raid";
    } else {
      await createEvent({
        type: "simulation",
        headline: "Power recalibrates",
        summary: "Whispers, tribute, and fear reshaped the underworld without a public flashpoint.",
        metadata: { reason }
      });
    }
  }

  balance = await getPopulationBalance();
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

async function getSimulationState() {
  return {
    isRunning: simulationState.isRunning,
    intervalMs: simulationState.intervalMs,
    lastTickAt: simulationState.lastTickAt,
    population: await getPopulationBalance()
  };
}

module.exports = {
  createEvent,
  listEvents,
  handleSuccession,
  hydrateLoreProfiles,
  generateEmergentCharacter,
  runSimulationTick,
  startSimulation,
  setSimulationRunning,
  getSimulationState
};
