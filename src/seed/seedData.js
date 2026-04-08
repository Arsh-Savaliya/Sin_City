require("dotenv").config();

const connectDB = require("../config/db");
const Person = require("../models/Person");
const Relationship = require("../models/Relationship");
const Crime = require("../models/Crime");
const Event = require("../models/Event");

async function seedDatabase() {
  const existing = await Person.countDocuments();
  if (existing > 0) {
    return;
  }

  const people = await Person.insertMany([
    {
      name: "Marcello Vane",
      alias: "The Velvet Knife",
      role: "criminal",
      faction: "Vane Syndicate",
      rank: "Boss",
      money: 9200000,
      cases: 11,
      crimesCommitted: ["Money laundering", "Extortion", "Witness tampering"],
      influenceScore: 96,
      powerLevel: 910,
      loyaltyScore: 92,
      ambitionLevel: 66,
      fearFactor: 95,
      intelligenceLevel: 87,
      status: "alive",
      isBoss: true,
      weaknessTags: ["ego", "legal pressure"],
      notes: "Controls the downtown shipping corridor."
    },
    {
      name: "Iris Vale",
      alias: "Black Orchid",
      role: "criminal",
      faction: "Vane Syndicate",
      rank: "Heir Apparent",
      money: 3500000,
      cases: 7,
      crimesCommitted: ["Fraud", "Conspiracy", "Cyber intrusion"],
      influenceScore: 85,
      powerLevel: 720,
      loyaltyScore: 83,
      ambitionLevel: 78,
      fearFactor: 72,
      intelligenceLevel: 94,
      status: "alive",
      weaknessTags: ["ego", "loyalty conflict"]
    },
    {
      name: "Nico Serrat",
      alias: "Ash",
      role: "criminal",
      faction: "Red Ledger",
      rank: "Lieutenant",
      money: 1600000,
      cases: 5,
      crimesCommitted: ["Armed robbery", "Racketeering"],
      influenceScore: 72,
      powerLevel: 560,
      loyaltyScore: 38,
      ambitionLevel: 89,
      fearFactor: 70,
      intelligenceLevel: 76,
      status: "alive",
      weaknessTags: ["greed", "ego"]
    },
    {
      name: "Elena Cruz",
      alias: "Cipher Saint",
      role: "criminal",
      faction: "Red Ledger",
      rank: "Broker",
      money: 2400000,
      cases: 4,
      crimesCommitted: ["Identity theft", "Data brokering"],
      influenceScore: 68,
      powerLevel: 490,
      loyaltyScore: 41,
      ambitionLevel: 86,
      fearFactor: 58,
      intelligenceLevel: 91,
      status: "alive",
      weaknessTags: ["greed", "legal pressure"]
    },
    {
      name: "Raka Sol",
      alias: "Dust Prince",
      role: "criminal",
      faction: "Outlands",
      rank: "Outsider",
      money: 150000,
      cases: 2,
      crimesCommitted: ["Arms dealing"],
      influenceScore: 32,
      powerLevel: 180,
      loyaltyScore: 18,
      ambitionLevel: 97,
      fearFactor: 33,
      intelligenceLevel: 88,
      status: "alive",
      isOutsider: true,
      weaknessTags: ["ego"]
    },
    {
      name: "Captain Helena Ward",
      role: "police",
      faction: "Sin City PD",
      rank: "Captain",
      cases: 14,
      casesSolved: 11,
      integrityScore: 88,
      influenceScore: 70,
      powerLevel: 430,
      loyaltyScore: 87,
      ambitionLevel: 44,
      fearFactor: 60,
      intelligenceLevel: 82,
      status: "alive",
      weaknessTags: ["legal pressure"]
    },
    {
      name: "Detective Owen Price",
      role: "police",
      faction: "Sin City PD",
      rank: "Detective",
      cases: 21,
      casesSolved: 16,
      integrityScore: 41,
      influenceScore: 62,
      powerLevel: 390,
      loyaltyScore: 29,
      ambitionLevel: 63,
      fearFactor: 51,
      intelligenceLevel: 74,
      isCorrupt: true,
      status: "alive",
      weaknessTags: ["greed", "loyalty conflict"]
    },
    {
      name: "Lieutenant Mara Flint",
      role: "police",
      faction: "Sin City PD",
      rank: "Lieutenant",
      cases: 12,
      casesSolved: 10,
      integrityScore: 77,
      influenceScore: 58,
      powerLevel: 360,
      loyaltyScore: 70,
      ambitionLevel: 36,
      fearFactor: 48,
      intelligenceLevel: 71,
      status: "alive",
      weaknessTags: ["fear"]
    }
  ]);

  const lookup = Object.fromEntries(people.map((person) => [person.name, person]));
  lookup["Marcello Vane"].heirCandidates = [lookup["Iris Vale"]._id, lookup["Nico Serrat"]._id];
  lookup["Captain Helena Ward"].heirCandidates = [lookup["Lieutenant Mara Flint"]._id];
  await Promise.all(people.map((person) => person.save()));

  await Relationship.insertMany([
    {
      source: lookup["Marcello Vane"]._id,
      target: lookup["Iris Vale"]._id,
      type: "command",
      weight: 4,
      tensionScore: 34,
      startedAt: new Date("2026-01-12T22:00:00.000Z"),
      details: "Strategic command chain."
    },
    {
      source: lookup["Marcello Vane"]._id,
      target: lookup["Nico Serrat"]._id,
      type: "alliance",
      weight: 3,
      tensionScore: 67,
      startedAt: new Date("2026-01-28T22:00:00.000Z"),
      details: "Shared smuggling routes with mutual distrust."
    },
    {
      source: lookup["Iris Vale"]._id,
      target: lookup["Elena Cruz"]._id,
      type: "transaction",
      weight: 2,
      tensionScore: 42,
      startedAt: new Date("2026-02-06T12:00:00.000Z"),
      details: "Encrypted account laundering."
    },
    {
      source: lookup["Nico Serrat"]._id,
      target: lookup["Elena Cruz"]._id,
      type: "rivalry",
      weight: 2,
      tensionScore: 88,
      startedAt: new Date("2026-02-15T17:00:00.000Z"),
      details: "Territorial conflict in the East Docks."
    },
    {
      source: lookup["Raka Sol"]._id,
      target: lookup["Elena Cruz"]._id,
      type: "alliance",
      weight: 1,
      tensionScore: 57,
      startedAt: new Date("2026-02-21T11:00:00.000Z"),
      details: "Outsider probing for an entry point."
    },
    {
      source: lookup["Captain Helena Ward"]._id,
      target: lookup["Lieutenant Mara Flint"]._id,
      type: "official",
      weight: 3,
      tensionScore: 18,
      startedAt: new Date("2026-01-18T08:00:00.000Z"),
      details: "Operational supervision."
    },
    {
      source: lookup["Lieutenant Mara Flint"]._id,
      target: lookup["Detective Owen Price"]._id,
      type: "official",
      weight: 2,
      tensionScore: 26,
      startedAt: new Date("2026-02-01T08:00:00.000Z"),
      details: "Active case assignment."
    },
    {
      source: lookup["Detective Owen Price"]._id,
      target: lookup["Marcello Vane"]._id,
      type: "corruption",
      weight: 4,
      tensionScore: 63,
      startedAt: new Date("2026-02-18T01:00:00.000Z"),
      details: "Paid protection racket."
    }
  ]);

  await Crime.insertMany([
    {
      crimeId: "CR-2091",
      title: "Port Meridian Gun Run",
      category: "Smuggling",
      status: "investigating",
      committedBy: [lookup["Marcello Vane"]._id, lookup["Nico Serrat"]._id],
      occurredAt: new Date("2026-02-11T23:15:00.000Z"),
      district: "Port Meridian",
      evidence: "Warehouse 14 ledger and dock camera stills",
      summary: "Unregistered weapons moved through a storm-shielded cargo route."
    },
    {
      crimeId: "CR-2098",
      title: "Cathedral Bank Ghost Transfer",
      category: "Cyber Fraud",
      status: "solved",
      committedBy: [lookup["Iris Vale"]._id, lookup["Elena Cruz"]._id],
      solvedBy: lookup["Captain Helena Ward"]._id,
      occurredAt: new Date("2026-02-27T08:30:00.000Z"),
      district: "Silver Quarter",
      evidence: "Blockchain trace, burner handset logs",
      summary: "Funds siphoned through shell corporations before being frozen."
    },
    {
      crimeId: "CR-2104",
      title: "North Spine Witness Vanishing",
      category: "Obstruction",
      status: "open",
      committedBy: [lookup["Marcello Vane"]._id, lookup["Iris Vale"]._id],
      occurredAt: new Date("2026-03-09T18:05:00.000Z"),
      district: "North Spine",
      evidence: "Anonymous tip and traffic tunnel audio",
      summary: "Key witness disappeared hours before federal testimony."
    }
  ]);

  await Event.insertMany([
    {
      type: "simulation",
      headline: "The city starts humming",
      summary: "Every faction entered the board already calculating who to betray and who to inherit from.",
      actor: lookup["Marcello Vane"]._id,
      happenedAt: new Date("2026-03-10T19:00:00.000Z"),
      faction: "Vane Syndicate"
    },
    {
      type: "alliance",
      headline: "An outsider is spotted near the docks",
      summary: "Raka Sol quietly opened channels with Elena Cruz, testing whether greed could crack Red Ledger.",
      actor: lookup["Raka Sol"]._id,
      target: lookup["Elena Cruz"]._id,
      happenedAt: new Date("2026-03-14T02:00:00.000Z"),
      faction: "Outlands"
    }
  ]);

  console.log("Database seeded");
}

async function runSeedScript() {
  await connectDB(process.env.MONGODB_URI);
  await seedDatabase();
  process.exit(0);
}

if (require.main === module) {
  runSeedScript().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  seedDatabase
};
