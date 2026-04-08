const mongoose = require("mongoose");

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

module.exports = mongoose.model("Event", eventSchema);
