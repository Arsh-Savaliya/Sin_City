const Person = require("../models/Person");

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const CHARACTER_LORE_SCHEMA = {
  type: "object",
  properties: {
    backgroundTier: {
      type: "string",
      enum: ["weak", "balanced", "powerful"]
    },
    backgroundSummary: {
      type: "string"
    },
    backstory: {
      type: "string"
    }
  },
  required: ["backgroundTier", "backgroundSummary", "backstory"]
};
const EVENT_NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string"
    },
    summary: {
      type: "string"
    }
  },
  required: ["headline", "summary"]
};

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
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
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

  throw new Error(
    `Unable to parse Gemini JSON: ${lastError?.message || "unknown parse failure"}`
  );
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

async function generateCharacterLore({
  person,
  fallbackLore,
  anchorName,
  worldState
}) {
  if (!isGeminiConfigured()) {
    return {
      ...fallbackLore,
      source: "local"
    };
  }

  try {
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
      return {
        ...fallbackLore,
        source: "local"
      };
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
    return {
      ...fallbackLore,
      source: "local"
    };
  }
}

async function generateEventNarrative({
  type,
  headline,
  summary,
  actorId,
  targetId,
  faction,
  metadata = {}
}) {
  if (!isGeminiConfigured()) {
    return {
      headline,
      summary,
      source: "local"
    };
  }

  try {
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
      return {
        headline,
        summary,
        source: "local"
      };
    }

    return {
      headline: clampSummary(parsed.headline || headline, 70),
      summary: clampSummary(parsed.summary || summary, 220),
      source: "gemini"
    };
  } catch (error) {
    console.error("Gemini event narration failed, using fallback", error.message);
    return {
      headline,
      summary,
      source: "local"
    };
  }
}

module.exports = {
  isGeminiConfigured,
  generateCharacterLore,
  generateEventNarrative
};
