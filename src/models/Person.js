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

module.exports = mongoose.model("Person", personSchema);
