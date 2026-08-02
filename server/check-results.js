// One-off diagnostic script - NOT part of the app, just for you to verify
// that test results are actually landing in MongoDB.
//
// Run with: node check-results.js
// (from inside your server/ folder, same place as index.js)

const mongoose = require("mongoose");
const TestResult = require("./models/TestResult");
const User = require("./models/User");

const MONGO_URI = "mongodb://127.0.0.1:27017/ai-test-platform";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.\n");

  const count = await TestResult.countDocuments();
  console.log(`Total TestResult documents: ${count}\n`);

  if (count === 0) {
    console.log("No results found yet. Take a test and submit/finish it, then run this again.");
  } else {
    const results = await TestResult.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .populate("user", "name email") // shows the actual user, not just an ObjectId
      .lean();

    results.forEach((r, i) => {
      console.log(`--- Result ${i + 1} ---`);
      console.log("User:", r.user ? `${r.user.name} (${r.user.email})` : "unknown");
      console.log("Role:", r.role);
      console.log("Submitted at:", r.submittedAt);
      console.log("Auto-submitted (violations):", r.autoSubmitted);
      console.log("Violation count:", r.violationCount);
      console.log("Violations:", JSON.stringify(r.violations, null, 2));
      console.log("Answers count:", r.answers.length);
      r.answers.forEach((a, j) => {
        console.log(`  Q${j + 1} [${a.matchStatus}] expected="${a.expectedOutput}" actual="${a.actualOutput}"`);
      });
      console.log("");
    });
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});