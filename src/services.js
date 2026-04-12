const mongoose = require("mongoose");
const { Person, Crime, Relationship, Event } = require("./models");

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

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
  return Person.create(payload);
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
        $set: { status: "weakening" },
        $mul: { weight: 0.45 }
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

async function getDashboardGraph() {
  const [people, relationships, crimes, events] = await Promise.all([
    Person.find().lean(),
    Relationship.find().populate("source target").lean(),
    Crime.find().populate("committedBy solvedBy").sort({ occurredAt: -1 }).lean(),
    Event.find().populate("actor target").sort({ happenedAt: -1 }).limit(30).lean()
  ]);

  const criminals = people.filter((person) => person.role === "criminal");
  const police = people.filter((person) => person.role === "police");

  const hierarchyLinks = relationships.filter((link) => link.type === "command");
  const policeLinks = relationships.filter(
    (link) =>
      link.type === "official" &&
      link.source?.role === "police" &&
      link.target?.role === "police"
  );
  const corruptionLinks = relationships.filter(
    (link) =>
      link.type === "corruption" ||
      (link.source?.role === "criminal" && link.target?.isCorrupt) ||
      (link.target?.role === "criminal" && link.source?.isCorrupt)
  );

  return {
    people,
    crimes,
    events,
    views: {
      criminalNetwork: {
        nodes: criminals,
        links: relationships.filter(
          (link) =>
            link.source?.role === "criminal" &&
            link.target?.role === "criminal"
        )
      },
      hierarchy: buildHierarchy(criminals, hierarchyLinks),
      policeNetwork: {
        nodes: police,
        links: policeLinks
      },
      corruptionNetwork: {
        nodes: people.filter((person) => person.role === "criminal" || person.isCorrupt),
        links: relationships.filter(
          (link) =>
            ["alliance", "rivalry", "transaction", "official", "corruption"].includes(link.type) &&
            [link.source?._id?.toString(), link.target?._id?.toString()].every(Boolean)
        )
      },
      powerNetwork: {
        nodes: people.filter((person) => person.role === "criminal"),
        links: relationships.filter(
          (link) =>
            ["alliance", "rivalry", "command", "transaction"].includes(link.type) &&
            link.source?.role === "criminal" &&
            link.target?.role === "criminal"
        )
      }
    }
  };
}

function buildHierarchy(nodes, links) {
  const lookup = new Map(
    nodes.map((node) => [
      node._id.toString(),
      {
        ...node,
        children: []
      }
    ])
  );

  const childIds = new Set();

  for (const link of links) {
    const sourceId = link.source?._id?.toString();
    const targetId = link.target?._id?.toString();
    const parent = lookup.get(sourceId);
    const child = lookup.get(targetId);

    if (parent && child) {
      parent.children.push(child);
      childIds.add(targetId);
    }
  }

  const roots = Array.from(lookup.values()).filter((node) => !childIds.has(node._id.toString()));
  return roots.length === 1 ? roots[0] : { name: "Syndicate", children: roots };
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

function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function geminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

async function requestGeminiJson(prompt, schema) {
  if (!isGeminiConfigured()) {
    return null;
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${geminiModel()}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          topP: 0.95,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
          ...(schema ? { responseJsonSchema: schema } : {})
        }
      })
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    return null;
  }

  return parseLooseJson(text);
}

function parseLooseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).replace(/^\uFEFF/, "").trim();
  const candidates = collectJsonCandidates(raw);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Unable to parse Gemini JSON: ${lastError?.message || "unknown parse failure"}`);
}

function collectJsonCandidates(raw) {
  const candidates = [];
  const pushCandidate = (value) => {
    const candidate = value?.trim();
    if (!candidate || candidates.includes(candidate)) {
      return;
    }
    candidates.push(candidate);
  };

  pushCandidate(raw);
  pushCandidate(sanitizeJsonCandidate(raw));

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const extracted = raw.slice(firstBrace, lastBrace + 1);
    pushCandidate(extracted);
    pushCandidate(sanitizeJsonCandidate(extracted));
  }

  return candidates;
}

function sanitizeJsonCandidate(value) {
  return escapeBareNewlinesInStrings(
    value
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
  );
}

function escapeBareNewlinesInStrings(value) {
  let escaped = "";
  let inString = false;
  let isEscaping = false;

  for (const character of value) {
    if (character === '"' && !isEscaping) {
      inString = !inString;
      escaped += character;
      continue;
    }

    if (inString && (character === "\n" || character === "\r")) {
      escaped += character === "\n" ? "\\n" : "\\r";
      isEscaping = false;
      continue;
    }

    escaped += character;
    isEscaping = character === "\\" && !isEscaping;
  }

  return escaped;
}

function clampSummary(text, maxLength = 420) {
  if (!text) {
    return text;
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

async function generateCharacterLore({ person, fallbackLore, anchorName, worldState }) {
  if (!isGeminiConfigured()) {
    return { ...fallbackLore, source: "local" };
  }

  try {
    const CHARACTER_LORE_SCHEMA = {
      type: "object",
      properties: {
        backgroundTier: { type: "string", enum: ["weak", "balanced", "powerful"] },
        backgroundSummary: { type: "string" },
        backstory: { type: "string" }
      },
      required: ["backgroundTier", "backgroundSummary", "backstory"]
    };

    const prompt = [
      "You are writing compact noir criminal-world lore for a simulation game.",
      "Return ONLY valid JSON with keys: backgroundTier, backgroundSummary, backstory.",
      'backgroundTier must be one of: "weak", "balanced", "powerful".',
      "backgroundSummary must be one sentence.",
      "backstory must be 2-4 sentences, grounded, cinematic, and believable.",
      "Do not use markdown, code fences, or extra keys.",
      "",
      `Character name: ${person.name}`,
      `Alias: ${person.alias || "None"}`,
      `Role: ${person.role}`,
      `Faction: ${person.faction || "Independent"}`,
      `Rank: ${person.rank || "Unknown"}`,
      `Power level: ${person.powerLevel}`,
      `Loyalty: ${person.loyaltyScore}`,
      `Ambition: ${person.ambitionLevel}`,
      `Fear: ${person.fearFactor}`,
      `Intelligence: ${person.intelligenceLevel}`,
      `Outsider: ${person.isOutsider ? "yes" : "no"}`,
      `Corrupt: ${person.isCorrupt ? "yes" : "no"}`,
      `Weakness tags: ${(person.weaknessTags || []).join(", ") || "none"}`,
      `Connected entry point: ${anchorName || "none"}`,
      `Current city pressure: ${worldState?.pressure || "stable"}`,
      "",
      `Fallback background tier: ${fallbackLore.backgroundTier}`,
      `Fallback summary: ${fallbackLore.backgroundSummary}`,
      `Fallback backstory: ${fallbackLore.backstory}`
    ].join("\n");

    const parsed = await requestGeminiJson(prompt, CHARACTER_LORE_SCHEMA);
    if (!parsed || typeof parsed !== "object") {
      return { ...fallbackLore, source: "local" };
    }

    const backgroundTier = ["weak", "balanced", "powerful"].includes(parsed.backgroundTier)
      ? parsed.backgroundTier
      : fallbackLore.backgroundTier;

    return {
      backgroundTier,
      backgroundSummary: clampSummary(parsed.backgroundSummary || fallbackLore.backgroundSummary, 160),
      backstory: clampSummary(parsed.backstory || fallbackLore.backstory, 700),
      source: "gemini"
    };
  } catch (error) {
    console.error("Gemini character lore failed, using fallback", error.message);
    return { ...fallbackLore, source: "local" };
  }
}

async function generateEventNarrative({ type, headline, summary, actorId, targetId, faction, metadata = {} }) {
  if (!isGeminiConfigured()) {
    return { headline, summary, source: "local" };
  }

  try {
    const EVENT_NARRATIVE_SCHEMA = {
      type: "object",
      properties: {
        headline: { type: "string" },
        summary: { type: "string" }
      },
      required: ["headline", "summary"]
    };

    const ids = [actorId, targetId].filter(Boolean);
    const people = ids.length
      ? await Person.find({ _id: { $in: ids } }).select("name alias faction rank backgroundTier").lean()
      : [];
    const actor = people.find((person) => actorId && person._id.toString() === actorId.toString());
    const target = people.find((person) => targetId && person._id.toString() === targetId.toString());

    const prompt = [
      "You are rewriting event narration for a dark crime-world simulation.",
      "Return ONLY valid JSON with keys: headline, summary.",
      "headline must stay under 70 characters and feel sharp and cinematic.",
      "summary must stay under 220 characters and be vivid but concise.",
      "Do not use markdown or extra keys.",
      "",
      `Event type: ${type}`,
      `Faction: ${faction || "Unknown"}`,
      `Actor: ${actor?.name || "Unknown"} ${actor?.alias ? `(${actor.alias})` : ""}`,
      `Target: ${target?.name || "Unknown"} ${target?.alias ? `(${target.alias})` : ""}`,
      `Base headline: ${headline}`,
      `Base summary: ${summary}`,
      `Metadata: ${JSON.stringify(metadata)}`
    ].join("\n");

    const parsed = await requestGeminiJson(prompt, EVENT_NARRATIVE_SCHEMA);
    if (!parsed || typeof parsed !== "object") {
      return { headline, summary, source: "local" };
    }

    return {
      headline: clampSummary(parsed.headline || headline, 70),
      summary: clampSummary(parsed.summary || summary, 220),
      source: "gemini"
    };
  } catch (error) {
    console.error("Gemini event narration failed, using fallback", error.message);
    return { headline, summary, source: "local" };
  }
}

async function createEvent(payload) {
  const narrative = await generateEventNarrative({
    type: payload.type,
    headline: payload.headline,
    summary: payload.summary,
    actorId: payload.actor,
    targetId: payload.target,
    faction: payload.faction,
    metadata: payload.metadata
  });

  return Event.create({
    ...payload,
    headline: narrative.headline,
    summary: narrative.summary,
    metadata: {
      ...(payload.metadata || {}),
      narrationSource: narrative.source
    }
  });
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

  return { generatedCount, killCount, aliveCount, deadCount, surplus, pressure, threshold: simulationState.populationPressureThreshold };
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
          $set: { status: "severed" }
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
      metadata: { tensionScore: rivalry.tensionScore, aiKill: true }
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
  if (!outsiders) {
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
      $inc: { weight: 1 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await createEvent({
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

async function generateEmergentCharacter() {
  const balance = await getPopulationBalance();
  if (balance.surplus >= simulationState.populationPressureThreshold) {
    return null;
  }

  const factions = await Person.aggregate([
    { $match: { role: "criminal", status: "alive" } },
    { $group: { _id: "$faction", count: { $sum: 1 }, avgLoyalty: { $avg: "$loyaltyScore" } } },
    { $sort: { avgLoyalty: 1, count: 1 } }
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

  const anchor = await Person.findOne({
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
    metadata: { generated: true, isOutsider, backgroundTier: enrichedLore.backgroundTier, loreSource: enrichedLore.source }
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
    metadata: { loyaltyScore: betrayer.loyaltyScore, ambitionLevel: betrayer.ambitionLevel }
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
      metadata: { aiKill: true, source: "raid" }
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
    summary: `${target.name} was removed as the underworld corrected its own overcrowding. New blood had outpaced the city's appetite, and ${target.name} was the next sacrifice.`,
    actor: killer?._id,
    faction: target.faction,
    metadata: { aiKill: true, source: "population-pressure", surplusBeforeKill: balance.surplus }
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
    population: await getPopulationBalance(),
    narrativeMode: isGeminiConfigured() ? "hybrid-gemini-local" : "local-only"
  };
}

function emitGraphRefresh(io, reason) {
  if (!io) {
    return;
  }
  setTimeout(async () => {
    try {
      const graph = await getDashboardGraph();
      io.emit("graph:refresh", { graph, reason, timestamp: new Date() });
    } catch (error) {
      console.error("Failed to emit graph refresh", error);
    }
  }, 50);
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
  isGeminiConfigured
};