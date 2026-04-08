const mongoose = require("mongoose");

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

module.exports = mongoose.model("Crime", crimeSchema);
