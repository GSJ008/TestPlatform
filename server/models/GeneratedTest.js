const mongoose = require("mongoose");

// Hidden test cases for one generated question. Deliberately its own
// collection, separate from the question payload sent to the client - the
// client only ever receives this document's _id (as "testId"), never the
// contents. Grading at /submit-test looks these up server-side.
const testCaseSchema = new mongoose.Schema(
  { input: String, output: String },
  { _id: false }
);

const generatedTestSchema = new mongoose.Schema({
  testCases: [testCaseSchema],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 6 // TTL: Mongo auto-deletes these 6 hours after creation
                         // (comfortably longer than the longest test duration),
                         // so this collection doesn't grow forever.
  }
});

module.exports = mongoose.model("GeneratedTest", generatedTestSchema);