const mongoose = require("mongoose");

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

module.exports = mongoose.model("Relationship", relationshipSchema);
