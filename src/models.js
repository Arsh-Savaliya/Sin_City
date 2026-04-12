const mongoose = require("mongoose");

const weaknessTags = ["greed", "fear", "loyalty conflict", "ego", "legal pressure"];

const personSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    alias: { type: String, trim: true },
    role: {
      type: String,
      enum: ["criminal", "police", "informant", "civilian"],
      required: true
    },
    faction: { type: String, trim: true },
    rank: { type: String, trim: true },
    money: { type: Number, default: 0 },
    cases: { type: Number, default: 0 },
    crimesCommitted: [{ type: String, trim: true }],
    influenceScore: { type: Number, default: 0 },
    integrityScore: { type: Number, default: 0 },
    casesSolved: { type: Number, default: 0 },
    powerLevel: { type: Number, default: 100, min: 0, max: 1000 },
    loyaltyScore: { type: Number, default: 50, min: 0, max: 100 },
    ambitionLevel: { type: Number, default: 50, min: 0, max: 100 },
    fearFactor: { type: Number, default: 50, min: 0, max: 100 },
    intelligenceLevel: { type: Number, default: 50, min: 0, max: 100 },
    dominanceScore: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["alive", "dead"],
      default: "alive"
    },
    isCorrupt: { type: Boolean, default: false },
    isBoss: { type: Boolean, default: false },
    isOutsider: { type: Boolean, default: false },
    backgroundTier: {
      type: String,
      enum: ["weak", "balanced", "powerful"]
    },
    backgroundSummary: { type: String, trim: true },
    backstory: { type: String, trim: true },
    heirCandidates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Person" }],
    weaknessTags: [
      {
        type: String,
        enum: weaknessTags
      }
    ],
    protectedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Person" }],
    joinedAt: { type: Date, default: Date.now },
    coordinates: {
      x: Number,
      y: Number
    },
    notes: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

personSchema.pre("save", function deriveDominance(next) {
  this.dominanceScore =
    this.powerLevel * 0.45 +
    this.influenceScore * 3 +
    this.fearFactor * 2 +
    this.intelligenceLevel * 1.2;
  next();
});

const Person = mongoose.model("Person", personSchema);

const crimeSchema = new mongoose.Schema(
  {
    crimeId: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "investigating", "solved", "cold"],
      default: "open"
    },
    committedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Person",
        required: true
      }
    ],
    solvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person"
    },
    occurredAt: { type: Date, required: true },
    district: { type: String, trim: true },
    evidence: { type: String, trim: true },
    summary: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

const Crime = mongoose.model("Crime", crimeSchema);

const relationshipSchema = new mongoose.Schema(
  {
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true
    },
    type: {
      type: String,
      enum: ["alliance", "rivalry", "transaction", "command", "official", "corruption"],
      required: true
    },
    weight: { type: Number, default: 1, min: 0 },
    tensionScore: { type: Number, default: 15, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["active", "weakening", "severed"],
      default: "active"
    },
    startedAt: { type: Date, default: Date.now },
    details: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

relationshipSchema.index({ source: 1, target: 1, type: 1 }, { unique: true });

const Relationship = mongoose.model("Relationship", relationshipSchema);

const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "assassination",
        "betrayal",
        "alliance",
        "raid",
        "takeover",
        "succession",
        "promotion",
        "elimination",
        "emergence",
        "simulation"
      ],
      required: true
    },
    headline: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "Person" },
    target: { type: mongoose.Schema.Types.ObjectId, ref: "Person" },
    faction: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    happenedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

const Event = mongoose.model("Event", eventSchema);

module.exports = { Person, Crime, Relationship, Event };