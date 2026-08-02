const mongoose = require("mongoose");

// One violation event - kept as a subdocument array so we retain the full
// history (reason + when it happened), not just a final tally.
const violationSchema = new mongoose.Schema(
  {
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

// One question + the candidate's answer for it, plus how many of the
// hidden test cases their submitted code actually passed (see
// /submit-test in index.js - it re-runs the code once per hidden case via
// Piston). This replaced an earlier "matchStatus" field that only compared
// a single expected output against whatever the candidate's last manual
// Run happened to produce - a much weaker signal than real grading.
const answerSchema = new mongoose.Schema(
  {
    title: String, // difficulty label from the AI ("Easy" | "Medium" | "Hard")
    question: String,
    example: String,
    submittedCode: String,
    language: String,
    actualOutput: String, // whatever /run-code last returned for this question (manual "Run" against the visible example)
    testsPassed: { type: Number, default: 0 },
    testsTotal: { type: Number, default: 0 }
  },
  { _id: false }
);

const testResultSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: { type: String, required: true },
    testTimeHours: Number,
    answers: [answerSchema],
    violations: [violationSchema],
    violationCount: { type: Number, default: 0 },
    autoSubmitted: { type: Boolean, default: false }, // true if 5-violation limit triggered submission
    startedAt: Date,
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TestResult", testResultSchema);