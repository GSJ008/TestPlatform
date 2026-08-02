require("dotenv").config({ path: require("path").join(__dirname, "server.env") });
// ^ NOTE: this project's env file is named "server.env", not ".env".
// dotenv.config() with no options only ever looks for ".env", so every
// variable in server.env (JWT_SECRET, MONGO_URI, and now the new Google/
// email settings below) was previously being silently ignored in favor of
// the hardcoded fallback defaults further down this file. Pointing dotenv
// at the actual filename fixes that.
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const JSON5 = require("json5");
const { OAuth2Client } = require("google-auth-library");

const User = require("./models/User");
const TestResult = require("./models/TestResult");
const GeneratedTest = require("./models/GeneratedTest");
const { sendVerificationEmail } = require("./utils/mailer");
const { syncUsersToExcel } = require("./utils/userExport");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ================= CONFIG =================
// In a real deployment these MUST come from environment variables, never
// hardcoded - this is fine for local development only.
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai-test-platform";
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-this";
const JWT_EXPIRES_IN = "8h";
const PISTON_URL = process.env.PISTON_URL || "http://localhost:2000/api/v2/execute";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ================= DATABASE =================
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected:", MONGO_URI);
    syncUsersToExcel(User); // pick up any users that already existed before this feature was added
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    console.error("Is MongoDB running? Start it before running this server.");
  });

// ================= AUTH MIDDLEWARE =================
// Verifies the JWT sent in the Authorization header. Any route that needs
// to know "who is making this request" (or simply needs to not be wide
// open to the public) should use this.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// ================= TEST ROUTE =================
app.get("/", (req, res) => {
  res.send("Backend is running");
});

// ================= REGISTER =================
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: passwordHash,
      authProvider: "local",
      isVerified: false,
      verificationToken,
      verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000 // 24h
    });

    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (mailErr) {
      // Don't fail registration just because the email couldn't be sent -
      // the account exists either way, and /resend-verification lets them
      // retry. But do log it loudly since it usually means mailer.js's
      // env vars are missing/wrong.
      console.error("Failed to send verification email:", mailErr.message);
    }

    syncUsersToExcel(User); // fire-and-forget - doesn't block the response

    res.json({
      success: true,
      message: "Account created! Check your email for a verification link before logging in."
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ success: false, message: "Registration failed" });
  }
});

// ================= VERIFY EMAIL =================
app.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: "Missing verification token" });
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "This verification link is invalid or has expired." });
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    syncUsersToExcel(User);

    res.json({ success: true, message: "Email verified! You can now log in." });
  } catch (err) {
    console.error("Verify email error:", err.message);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
});

// ================= RESEND VERIFICATION =================
app.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    // Generic response either way - don't reveal whether an email is registered.
    const genericMessage = "If that account exists and isn't verified yet, a new verification email has been sent.";

    if (!user || user.authProvider !== "local" || user.isVerified) {
      return res.json({ success: true, message: genericMessage });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(user.email, user.name, verificationToken);

    res.json({ success: true, message: genericMessage });
  } catch (err) {
    console.error("Resend verification error:", err.message);
    res.status(500).json({ success: false, message: "Could not resend verification email" });
  }
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Same generic message as a wrong password, on purpose - this avoids
      // leaking whether a given email is registered at all.
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (user.authProvider === "google") {
      return res.status(400).json({
        success: false,
        message: "This account uses Google Sign-In. Please continue with Google instead."
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in. Check your inbox for the verification link."
      });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ success: false, message: "Login failed" });
  }
});

// ================= GOOGLE SIGN-IN =================
// Client sends the ID token it got from Google Identity Services. We verify
// it directly with Google's servers (never trust a token's claims without
// verifying the signature) and then find-or-create the local user record.
app.post("/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: "Missing Google credential" });
    }
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, message: "Google Sign-In is not configured on the server (missing GOOGLE_CLIENT_ID)." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ success: false, message: "Google account email is not verified." });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (!user) {
      user = await User.create({
        name: name || email.split("@")[0],
        email: email.toLowerCase(),
        authProvider: "google",
        googleId,
        isVerified: true
      });
      syncUsersToExcel(User);
    } else if (!user.googleId) {
      // An account with this email already existed as a local account -
      // link it to Google rather than creating a duplicate user.
      user.googleId = googleId;
      user.isVerified = true;
      await user.save();
      syncUsersToExcel(User);
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error("Google auth error:", err.message);
    res.status(401).json({ success: false, message: "Google sign-in failed" });
  }
});

// ================= AI JSON EXTRACTOR (IMPORTANT) =================
// ================= AI JSON EXTRACTOR =================
// Uses multiple strategies in order of preference.
// The AI (llama3) frequently produces subtly broken JSON:
// missing commas, unquoted keys, triple quotes, hidden Unicode chars.
// Rather than trying to patch every possible variant, we:
//   1. Try standard JSON.parse on the raw extracted block
//   2. Try JSON5 (fault-tolerant parser, handles most LLM quirks)
//   3. Try collapsing all whitespace first then JSON5 again
//   4. Try extracting just the questions array directly
function extractAndParseJSON(text) {
  // Strip common hidden Unicode characters LLMs embed invisibly
  const clean = text
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "") // zero-width/soft chars
    .replace(/[\u2018\u2019]/g, "'")              // smart single quotes
    .replace(/[\u201c\u201d]/g, '"');             // smart double quotes

  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");

  const block = clean.slice(start, end + 1);

  // Strategy 1: standard JSON.parse (fastest, strictest)
  try { return JSON.parse(block); } catch (_) {}

  // Strategy 2: JSON5 - handles unquoted keys, trailing commas, single
  // quotes, comments, and most other LLM JSON quirks natively
  try { return JSON5.parse(block); } catch (_) {}

  // Strategy 3: collapse all structural whitespace then try JSON5
  // (handles cases where hidden chars are embedded between tokens)
  try {
    const flat = block.replace(/\s+/g, " ").trim();
    return JSON5.parse(flat);
  } catch (_) {}

  // Strategy 4: repair common LLM-specific JSON mistakes that no amount of
  // whitespace normalization fixes - most notably llama3 getting "lazy"
  // partway through a long array/object and inserting a literal "..."
  // instead of writing out every element, e.g.
  // ["a", "b", ... "z"] or {"a": 1, ... "z": 26}
  // This one syntax error breaks parsing for the ENTIRE response, not just
  // the field it's in, which is why this needs its own repair pass rather
  // than just being tolerated.
  try {
    const repaired = block
      .replace(/,?\s*\.\.\.[^,\]}]*(?=[,\]}])/g, "") // drop ", ... anything" before the next , ] or }
      .replace(/,(\s*[\]}])/g, "$1");                 // then clean up any trailing commas that leaves behind
    return JSON5.parse(repaired);
  } catch (_) {}

  // Strategy 5: extract just the questions array from the text directly
  // (bypasses the outer object entirely in case it's malformed), also
  // through the same repair pass as strategy 4.
  try {
    const arrStart = clean.indexOf("[");
    const arrEnd = clean.lastIndexOf("]");
    if (arrStart !== -1 && arrEnd !== -1) {
      const arrBlock = clean.slice(arrStart, arrEnd + 1)
        .replace(/,?\s*\.\.\.[^,\]}]*(?=[,\]}])/g, "")
        .replace(/,(\s*[\]}])/g, "$1");
      const arr = JSON5.parse(arrBlock);
      if (Array.isArray(arr)) return { questions: arr };
    }
  } catch (_) {}

  throw new Error("All JSON parsing strategies failed on AI output");
}
// ================= AI QUESTION GENERATION (PROTECTED) =================

// Each entry describes THEMING, not required APIs - every question still
// has to compile down to "one function, one input, one output" so it fits
// the generic starter code and actually runs in Piston's plain sandbox
// (no browser, no DOM, no filesystem, no network - none of that exists in
// the execution environment, regardless of which language is chosen).
// Earlier versions of this guidance said things like "DOM manipulation" or
// "React hooks" for Frontend/React roles, which produced questions that
// were never actually runnable - the mismatch the "code doesn't match the
// question" bug was coming from.
const ROLE_GUIDANCE = {
  "Frontend Developer":   "string/array algorithms themed around UI data - formatting display labels, validating form-input strings, transforming or sorting lists of items to render",
  "Backend Developer":    "string/array algorithms themed around server concepts - parsing request-like strings, validating payloads, rate-limit counters, cache-key logic (pure logic only, not real network/DB calls)",
  "Full Stack Developer": "a mix of the frontend-flavored and backend-flavored algorithmic themes above",
  "React Developer":      "string/array algorithms themed around component data - deduplicating lists, computing derived values from state-like input, diffing two lists (pure logic only, not real React/DOM code)",
  "Node.js Developer":    "string/array algorithms themed around backend data processing - parsing log-line strings, aggregating counts, queue/order simulation (pure logic only, not real file or network I/O)",
  "Python Developer":     "classic data structure and algorithm problems using clean, idiomatic function-based Python",
  "Java Developer":       "classic data structure and algorithm problems using clean, idiomatic function-based Java (no need for classes beyond what's already provided)",
  "DevOps Engineer":      "string/array algorithms themed around ops data - parsing log lines, config strings, and deployment sequences (pure logic only, not real shell/file access)",
  "Data Scientist":       "numeric/array algorithms - aggregation, filtering, basic statistics over a list of numbers",
  "Mobile Developer":     "classic algorithms and data structures with clean, efficient, performance-aware code"
};

// Which languages make sense to offer for each role. Keeps someone from
// picking a combo like "Frontend Developer" + "C" that the AI then has to
// awkwardly force a theme onto - matches the LANGUAGE_LABELS keys below.
const ROLE_LANGUAGES = {
  "Frontend Developer":   ["javascript", "typescript"],
  "Backend Developer":    ["javascript", "typescript", "python", "java", "go", "csharp", "cpp", "c"],
  "Full Stack Developer": ["javascript", "typescript", "python", "java", "go"],
  "React Developer":      ["javascript", "typescript"],
  "Node.js Developer":    ["javascript", "typescript"],
  "Python Developer":     ["python"],
  "Java Developer":       ["java"],
  "DevOps Engineer":      ["python", "javascript", "go"],
  "Data Scientist":       ["python"],
  "Mobile Developer":     ["kotlin", "java", "csharp", "javascript"]
};

const LANGUAGE_LABELS = {
  python: "Python", javascript: "JavaScript", typescript: "TypeScript",
  java: "Java", kotlin: "Kotlin", go: "Go",
  c: "C", cpp: "C++", csharp: "C#"
};

// ================= TYPED STARTER CODE GENERATOR =================
// We NEVER ask the AI to write actual code - it's unreliable at following
// language instructions. Instead the AI just declares, per question, what
// TYPE of value goes in and comes out ("int" | "string" | "int_array"),
// plus a visible example and 12 hidden test cases in that type's format.
// From that, we build real boilerplate that reads a value of the right
// type from stdin, calls the candidate's solve(), and prints the result in
// the right format - the same unmodified submitted code can then be run
// once per hidden test case (different stdin each time) to grade it, the
// same way an online judge works. This is also what fixes starter code
// actually matching the question: an array question gets array-parsing
// code, not a generic string stub.
const VALID_TYPES = ["int", "string", "int_array", "string_array"];

function normalizeType(t) {
  return VALID_TYPES.includes(t) ? t : "string";
}

// One line of stdin -> a language-native value, per (language, type).
const READERS = {
  python: {
    int:       (v) => `${v} = int(input())`,
    string:    (v) => `${v} = input()`,
    int_array: (v) => `${v} = list(map(int, input().split(",")))`,
    string_array: (v) => `${v} = input().split(",")`
  },
  javascript: {
    int:       (v) => `const ${v} = parseInt(__input, 10);`,
    string:    (v) => `const ${v} = __input;`,
    int_array: (v) => `const ${v} = __input.split(",").map(Number);`,
    string_array: (v) => `const ${v} = __input.split(",");`
  },
  typescript: {
    int:       (v) => `const ${v}: number = parseInt(__input, 10);`,
    string:    (v) => `const ${v}: string = __input;`,
    int_array: (v) => `const ${v}: number[] = __input.split(",").map(Number);`,
    string_array: (v) => `const ${v}: string[] = __input.split(",");`
  },
  go: {
    int:       (v) => `${v}, _ := strconv.Atoi(__line)`,
    string:    (v) => `${v} := __line`,
    int_array: (v) => `__parts := strings.Split(__line, ",")\n\t${v} := make([]int, len(__parts))\n\tfor i, p := range __parts {\n\t\t${v}[i], _ = strconv.Atoi(strings.TrimSpace(p))\n\t}`,
    string_array: (v) => `${v} := strings.Split(__line, ",")`
  },
  kotlin: {
    int:       (v) => `val ${v} = __line.toInt()`,
    string:    (v) => `val ${v} = __line`,
    int_array: (v) => `val ${v} = __line.split(",").map { it.trim().toInt() }.toIntArray()`,
    string_array: (v) => `val ${v} = __line.split(",")`
  },
  java: {
    int:       (v) => `int ${v} = Integer.parseInt(__line.trim());`,
    string:    (v) => `String ${v} = __line;`,
    int_array: (v) => `String[] __parts = __line.split(",");\n        int[] ${v} = new int[__parts.length];\n        for (int i = 0; i < __parts.length; i++) ${v}[i] = Integer.parseInt(__parts[i].trim());`,
    string_array: (v) => `String[] ${v} = __line.split(",");`
  },
  csharp: {
    int:       (v) => `int ${v} = int.Parse(__line.Trim());`,
    string:    (v) => `string ${v} = __line;`,
    int_array: (v) => `int[] ${v} = Array.ConvertAll(__line.Split(','), p => int.Parse(p.Trim()));`,
    string_array: (v) => `string[] ${v} = __line.Split(',');`
  },
  cpp: {
    int:       (v) => `int ${v}; ${v} = stoi(__line);`,
    string:    (v) => `string ${v} = __line;`,
    int_array: (v) => `vector<int> ${v}; { stringstream ss(__line); string tok; while (getline(ss, tok, ',')) ${v}.push_back(stoi(tok)); }`,
    string_array: (v) => `vector<string> ${v}; { stringstream ss(__line); string tok; while (getline(ss, tok, ',')) ${v}.push_back(tok); }`
  },
  // Plain C has no built-in dynamic array/string return type, so int_array
  // OUTPUT is handled specially in buildC() below rather than through this
  // generic reader/printer pair (which only covers input parsing here).
  c: {
    int:       (v) => `int ${v}; scanf("%d", &${v});`,
    string:    (v) => `char ${v}[1000];\n    fgets(${v}, sizeof(${v}), stdin);\n    { size_t __len = strlen(${v}); if (__len > 0 && ${v}[__len-1] == '\\n') ${v}[__len-1] = '\\0'; }`,
    int_array: (v) => `int ${v}[1000]; int ${v}_n = 0;\n    { char __line[4000]; fgets(__line, sizeof(__line), stdin); char* __tok = strtok(__line, ","); while (__tok) { ${v}[${v}_n++] = atoi(__tok); __tok = strtok(NULL, ","); } }`
  }
};

// A language-native value -> printed stdout, per (language, type).
const PRINTERS = {
  python: {
    int:       (v) => `print(${v})`,
    string:    (v) => `print(${v})`,
    int_array: (v) => `print(",".join(map(str, ${v})))`,
    string_array: (v) => `print(",".join(${v}))`
  },
  javascript: {
    int:       (v) => `console.log(${v});`,
    string:    (v) => `console.log(${v});`,
    int_array: (v) => `console.log(${v}.join(","));`,
    string_array: (v) => `console.log(${v}.join(","));`
  },
  typescript: {
    int:       (v) => `console.log(${v});`,
    string:    (v) => `console.log(${v});`,
    int_array: (v) => `console.log(${v}.join(","));`,
    string_array: (v) => `console.log(${v}.join(","));`
  },
  go: {
    int:       (v) => `fmt.Println(${v})`,
    string:    (v) => `fmt.Println(${v})`,
    int_array: (v) => `__strs := make([]string, len(${v}))\n\tfor i, __n := range ${v} {\n\t\t__strs[i] = strconv.Itoa(__n)\n\t}\n\tfmt.Println(strings.Join(__strs, ","))`,
    string_array: (v) => `fmt.Println(strings.Join(${v}, ","))`
  },
  kotlin: {
    int:       (v) => `println(${v})`,
    string:    (v) => `println(${v})`,
    int_array: (v) => `println(${v}.joinToString(","))`,
    string_array: (v) => `println(${v}.joinToString(","))`
  },
  java: {
    int:       (v) => `System.out.println(${v});`,
    string:    (v) => `System.out.println(${v});`,
    int_array: (v) => `StringBuilder __sb = new StringBuilder();\n        for (int i = 0; i < ${v}.length; i++) { if (i > 0) __sb.append(","); __sb.append(${v}[i]); }\n        System.out.println(__sb.toString());`,
    string_array: (v) => `System.out.println(String.join(",", ${v}));`
  },
  csharp: {
    int:       (v) => `Console.WriteLine(${v});`,
    string:    (v) => `Console.WriteLine(${v});`,
    int_array: (v) => `Console.WriteLine(string.Join(",", ${v}));`,
    string_array: (v) => `Console.WriteLine(string.Join(",", ${v}));`
  },
  cpp: {
    int:       (v) => `cout << ${v} << endl;`,
    string:    (v) => `cout << ${v} << endl;`,
    int_array: (v) => `for (size_t i = 0; i < ${v}.size(); i++) { if (i > 0) cout << ","; cout << ${v}[i]; }\n    cout << endl;`,
    string_array: (v) => `for (size_t i = 0; i < ${v}.size(); i++) { if (i > 0) cout << ","; cout << ${v}[i]; }\n    cout << endl;`
  }
  // C's printer is inlined in buildC() below since int_array output there
  // needs an extra out-length parameter, not just a value to format.
};

const JAVA_TYPE = { int: "int", string: "String", int_array: "int[]", string_array: "String[]" };
const CSHARP_TYPE = { int: "int", string: "string", int_array: "int[]", string_array: "string[]" };
const CPP_TYPE = { int: "int", string: "string", int_array: "vector<int>", string_array: "vector<string>" };
const TS_TYPE = { int: "number", string: "string", int_array: "number[]", string_array: "string[]" };
const GO_TYPE = { int: "int", string: "string", int_array: "[]int", string_array: "[]string" };
const KOTLIN_TYPE = { int: "Int", string: "String", int_array: "IntArray", string_array: "List<String>" };
const JAVA_DEFAULT = { int: "0", string: '""', int_array: "new int[0]", string_array: "new String[0]" };
const CSHARP_DEFAULT = { int: "0", string: '""', int_array: "new int[0]", string_array: "new string[0]" };
const CPP_DEFAULT = { int: "0", string: '""', int_array: "vector<int>()", string_array: "vector<string>()" };
const TS_DEFAULT = { int: "0", string: '""', int_array: "[]", string_array: "[]" };
const GO_DEFAULT = { int: "0", string: '""', int_array: "[]int{}", string_array: "[]string{}" };
const KOTLIN_DEFAULT = { int: "0", string: '""', int_array: "IntArray(0)", string_array: "emptyList()" };

function buildPython(inputType, outputType) {
  const param = (inputType === "int_array" || inputType === "string_array") ? "arr" : inputType === "int" ? "n" : "s";
  return `def solve(${param}):
    # Write your solution here
    pass

${READERS.python[inputType](param)}
result = solve(${param})
${PRINTERS.python[outputType]("result")}`;
}

function buildJavaScript(inputType, outputType) {
  const param = (inputType === "int_array" || inputType === "string_array") ? "arr" : inputType === "int" ? "n" : "s";
  return `function solve(${param}) {
  // Write your solution here
}

const __input = require("fs").readFileSync(0, "utf-8").trim();
${READERS.javascript[inputType](param)}
const result = solve(${param});
${PRINTERS.javascript[outputType]("result")}`;
}

function buildTypeScript(inputType, outputType) {
  const param = (inputType === "int_array" || inputType === "string_array") ? "arr" : inputType === "int" ? "n" : "s";
  const paramType = TS_TYPE[inputType];
  const returnType = TS_TYPE[outputType];
  return `// Minimal ambient declaration so this compiles without needing
// @types/node installed in the execution environment.
declare function require(id: string): any;

function solve(${param}: ${paramType}): ${returnType} {
  // Write your solution here
  return ${TS_DEFAULT[outputType]};
}

const __input: string = require("fs").readFileSync(0, "utf-8").trim();
${READERS.typescript[inputType](param)}
const result: ${returnType} = solve(${param});
${PRINTERS.typescript[outputType]("result")}`;
}

function buildJava(inputType, outputType) {
  const param = (inputType === "int_array" || inputType === "string_array") ? "arr" : inputType === "int" ? "n" : "s";
  const paramType = JAVA_TYPE[inputType];
  const returnType = JAVA_TYPE[outputType];
  return `import java.util.*;

public class Main {
    public static ${returnType} solve(${paramType} ${param}) {
        // Write your solution here
        return ${JAVA_DEFAULT[outputType]};
    }

    public static void main(String[] args) {
        Scanner __scanner = new Scanner(System.in);
        String __line = __scanner.nextLine();
        ${READERS.java[inputType](param)}
        ${returnType} result = solve(${param});
        ${PRINTERS.java[outputType]("result")}
    }
}`;
}

function buildCsharp(inputType, outputType) {
  const param = (inputType === "int_array" || inputType === "string_array") ? "arr" : inputType === "int" ? "n" : "s";
  const paramType = CSHARP_TYPE[inputType];
  const returnType = CSHARP_TYPE[outputType];
  return `using System;

class Solution {
    static ${returnType} Solve(${paramType} ${param}) {
        // Write your solution here
        return ${CSHARP_DEFAULT[outputType]};
    }

    static void Main() {
        string __line = Console.ReadLine();
        ${READERS.csharp[inputType](param)}
        ${returnType} result = Solve(${param});
        ${PRINTERS.csharp[outputType]("result")}
    }
}`;
}

function buildCpp(inputType, outputType) {
  const param = (inputType === "int_array" || inputType === "string_array") ? "arr" : inputType === "int" ? "n" : "s";
  const paramType = CPP_TYPE[inputType];
  const returnType = CPP_TYPE[outputType];
  return `#include <iostream>
#include <string>
#include <vector>
#include <sstream>
using namespace std;

${returnType} solve(${paramType} ${param}) {
    // Write your solution here
    return ${CPP_DEFAULT[outputType]};
}

int main() {
    string __line;
    getline(cin, __line);
    ${READERS.cpp[inputType](param)}
    ${returnType} result = solve(${param});
    ${PRINTERS.cpp[outputType]("result")}
    return 0;
}`;
}

// Go is stricter than the other languages here: an unused import is a
// compile error, and strconv is only needed if an int or int_array is
// involved on either side, so the import list is built conditionally
// rather than always including everything.
function buildGo(inputType, outputType) {
  const param = (inputType === "int_array" || inputType === "string_array") ? "arr" : inputType === "int" ? "n" : "s";
  const needsStrconv = [inputType, outputType].some((t) => t === "int" || t === "int_array");
  const returnType = GO_TYPE[outputType];
  const imports = ["bufio", "fmt", "os", "strings", ...(needsStrconv ? ["strconv"] : [])].sort();

  return `package main

import (
${imports.map((i) => `\t"${i}"`).join("\n")}
)

func solve(${param} ${GO_TYPE[inputType]}) ${returnType} {
\t// Write your solution here
\treturn ${GO_DEFAULT[outputType]}
}

func main() {
\treader := bufio.NewReader(os.Stdin)
\t__line, _ := reader.ReadString('\\n')
\t__line = strings.TrimSpace(__line)

\t${READERS.go[inputType](param)}
\tresult := solve(${param})
\t${PRINTERS.go[outputType]("result")}
}`;
}

function buildKotlin(inputType, outputType) {
  const param = (inputType === "int_array" || inputType === "string_array") ? "arr" : inputType === "int" ? "n" : "s";
  const paramType = KOTLIN_TYPE[inputType];
  const returnType = KOTLIN_TYPE[outputType];
  return `fun solve(${param}: ${paramType}): ${returnType} {
    // Write your solution here
    return ${KOTLIN_DEFAULT[outputType]}
}

fun main() {
    val __line = readLine()!!.trim()
    ${READERS.kotlin[inputType](param)}
    val result = solve(${param})
    ${PRINTERS.kotlin[outputType]("result")}
}`;
}

// Plain C has no built-in dynamic array or string return type, so it needs
// its own layout: array OUTPUT is reported through an extra out-length
// pointer parameter rather than a return value alone.
function buildC(inputType, outputType) {
  // C also has no reasonable built-in array-of-strings type without a lot
  // of fixed-buffer-of-fixed-buffers plumbing that's disproportionate to
  // how often C actually gets picked as the test language - fall back to
  // treating string_array as a single string for C only. Every other
  // supported language handles string_array for real (see READERS/PRINTERS
  // above).
  inputType = inputType === "string_array" ? "string" : inputType;
  outputType = outputType === "string_array" ? "string" : outputType;

  const param = (inputType === "int_array" || inputType === "string_array") ? "arr" : inputType === "int" ? "n" : "s";
  const inputParams =
    inputType === "int_array" ? `int* ${param}, int ${param}_n` :
    inputType === "int"       ? `int ${param}` :
                                 `char* ${param}`;

  if (outputType === "int_array") {
    return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Write the result into out (max 1000 ints) and set *outN to how many
// values you wrote - this is how C reports an array back without a
// built-in dynamic array type.
void solve(${inputParams}, int* out, int* outN) {
    // Write your solution here
    *outN = 0;
}

int main() {
    ${READERS.c[inputType](param)}
    int __out[1000]; int __outN = 0;
    solve(${param}${inputType === "int_array" ? `, ${param}_n` : ""}, __out, &__outN);
    for (int i = 0; i < __outN; i++) { if (i > 0) printf(","); printf("%d", __out[i]); }
    printf("\\n");
    return 0;
}`;
  }

  const returnType = outputType === "int" ? "int" : "char*";
  const defaultReturn = outputType === "int" ? "return 0;" : 'return "";';
  const printCall = outputType === "int" ? `printf("%d\\n", result);` : `printf("%s\\n", result);`;

  return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

${returnType} solve(${inputParams}) {
    // Write your solution here
    ${defaultReturn}
}

int main() {
    ${READERS.c[inputType](param)}
    ${returnType} result = solve(${param}${inputType === "int_array" ? `, ${param}_n` : ""});
    ${printCall}
    return 0;
}`;
}

const STARTER_BUILDERS = {
  python: buildPython,
  javascript: buildJavaScript,
  typescript: buildTypeScript,
  java: buildJava,
  csharp: buildCsharp,
  cpp: buildCpp,
  c: buildC,
  go: buildGo,
  kotlin: buildKotlin
};

// Builds starter code in every supported language at once (not just the
// language the candidate picked at config time), so switching the language
// dropdown mid-test shows correctly-typed code immediately, no extra
// request needed.
function buildStarterCodeByLanguage(inputType, outputType) {
  const result = {};
  for (const lang of Object.keys(STARTER_BUILDERS)) {
    try {
      result[lang] = STARTER_BUILDERS[lang](inputType, outputType);
    } catch (err) {
      console.error(`Starter code build failed for ${lang}/${inputType}->${outputType}:`, err.message);
      result[lang] = STARTER_BUILDERS[lang]("string", "string");
    }
  }
  return result;
}

// Formats a {input, output} pair (or falls back to a placeholder) into the
// human-readable "Input: ... Output: ..." string shown to the candidate.
function formatExampleDisplay(example) {
  if (!example || !example.input) {
    return "No example was generated for this question — read the problem statement carefully for the expected input/output format.";
  }
  return `Input: ${example.input}   Output: ${example.output ?? ""}`;
}

app.post("/generate-questions", requireAuth, async (req, res) => {
  const { role, language = "python" } = req.body;
  const roleGuide = ROLE_GUIDANCE[role] || "general programming concepts";
  const languageLabel = LANGUAGE_LABELS[language] || "Python";

  try {
    // Ask AI for ONLY question text, typing, and test data - NOT code.
    // This removes the #1 source of failures: the AI generating wrong-
    // language code. We build real, correctly-typed starter code ourselves
    // from inputType/outputType (see the typed starter code generator
    // above), and grade submissions against the hidden testCases here the
    // same way an online judge does - the AI never touches actual grading.
    const prompt = `Generate 3 coding interview questions for a ${role}, to be solved in ${languageLabel}.
Theme: ${roleGuide}

FORMAT RULES (the candidate's code editor provides a single function that takes ONE typed input and returns ONE typed output - every question must fit this exactly):
- "inputType" and "outputType" must each be one of: "int", "string", "int_array" (comma-separated integers, e.g. "1,2,3,-4"), "string_array" (comma-separated words, e.g. "cat,dog,bird").
- Pick types that actually match the problem (e.g. an array-reversal problem is inputType "int_array" / outputType "int_array"; a "count vowels" problem is inputType "string" / outputType "int"; a "reverse every word in a list" problem is inputType "string_array" / outputType "string_array").
- Do NOT create questions requiring a browser, DOM, UI framework, database, file system, or network access - none of that exists in the sandboxed ${languageLabel} runtime the code actually runs in. Keep the role's theme in the wording only, not in required APIs.
- "example" must be ONE illustrative {input, output} pair, formatted as plain comma-separated values matching inputType/outputType (e.g. int_array as "1,2,3", never as "[1,2,3]").
- "testCases" must be exactly 12 DIFFERENT {input, output} pairs, same format as "example", covering typical cases plus edge cases (empty/small/negative/large values as appropriate). Hidden from the candidate, used only for grading.
- CRITICAL: write out every single test case IN FULL, every time. NEVER use "...", "etc", or any other shorthand/truncation ANYWHERE in your response, even for long or repetitive lists - an ellipsis anywhere in your output breaks the entire response and none of it can be used. If a list would be long, still spell out every element individually.

Respond with ONLY JSON in exactly this shape (no extra text, no markdown, no code blocks, and remember: no "..." anywhere, every field fully written out):
{"questions":[
  {"title":"Easy","question":"problem statement here","inputType":"int_array","outputType":"int_array","example":{"input":"1,2,3","output":"3,2,1"},"testCases":[{"input":"4,5,6","output":"6,5,4"},{"input":"7,8","output":"8,7"}]},
  {"title":"Medium","question":"problem statement here","inputType":"string","outputType":"int","example":{"input":"hello","output":"5"},"testCases":[{"input":"hi","output":"2"},{"input":"a","output":"1"}]},
  {"title":"Hard","question":"problem statement here","inputType":"string_array","outputType":"int","example":{"input":"cat,dog","output":"2"},"testCases":[{"input":"a,b,c","output":"3"},{"input":"","output":"0"}]}
]}
(the testCases arrays above show only 2 entries as a shape example - your actual testCases arrays must each have 12 fully written-out entries)`;

    // llama3 occasionally produces malformed JSON despite the format
    // rules (truncation shorthand, stray preamble text, etc.) - one retry
    // with a fresh generation costs a few seconds but recovers most of
    // these cases instead of failing the whole request outright.
    let raw, parsed;
    let lastParseError;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await axios.post(
        "http://localhost:11434/api/generate",
        { model: "llama3", prompt, stream: false }
      );
      raw = response.data.response;
      console.log(`RAW AI OUTPUT (attempt ${attempt + 1}):\n`, raw);

      try {
        parsed = extractAndParseJSON(raw);
        break;
      } catch (err) {
        lastParseError = err;
        parsed = null;
        console.warn(`Parse attempt ${attempt + 1} failed:`, err.message);
      }
    }

    if (!parsed) {
      console.error("AI ERROR:", lastParseError?.message);
      return res.status(500).json({ error: "AI generation failed - the model's response couldn't be parsed after retrying. Try again." });
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return res.status(500).json({ error: "Invalid AI questions format" });
    }

    // Build each question: validate/sanitize what the AI gave us, generate
    // real starter code from the (validated) types, and persist the hidden
    // test cases server-side - the client response below never includes
    // testCases, inputType, or outputType.
    const questions = await Promise.all(parsed.questions.map(async (q) => {
      const inputType = normalizeType(q.inputType);
      const outputType = normalizeType(q.outputType);

      const example = (q.example && typeof q.example === "object" && q.example.input)
        ? { input: String(q.example.input), output: String(q.example.output ?? "") }
        : null;

      const rawCases = Array.isArray(q.testCases) ? q.testCases : [];
      let testCases = rawCases
        .filter((c) => c && c.input !== undefined && c.output !== undefined)
        .map((c) => ({ input: String(c.input), output: String(c.output) }))
        .slice(0, 12);

      // llama3 doesn't always hit exactly 12 - pad using the example (if we
      // have one) rather than shipping fewer hidden cases than intended.
      // If there's truly nothing usable, grading later just runs against
      // whatever we do have (see /submit-test).
      if (testCases.length === 0 && example) testCases = [example];
      while (testCases.length > 0 && testCases.length < 12) {
        testCases.push(testCases[testCases.length % rawCases.length || 0]);
      }

      const generatedTest = await GeneratedTest.create({ testCases });

      return {
        title: q.title,
        question: q.question,
        example: formatExampleDisplay(example),
        exampleInput: example ? example.input : "",
        exampleOutput: example ? example.output : "",
        starterCodeByLanguage: buildStarterCodeByLanguage(inputType, outputType),
        testId: generatedTest._id.toString()
      };
    }));

    res.json(questions);

  } catch (err) {
    console.error("AI ERROR:", err.message);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ================= RUN CODE (PROTECTED) =================
// Code execution is now sandboxed via Piston (running locally in Docker).
// Previously this used exec() directly on the host - any submitted code
// could read/write files, open network connections, or crash the server.
// Piston runs each submission in an isolated container with strict resource
// limits (memory, CPU, process count, network access) applied by isolate.
// Maps the language names your frontend sends to Piston's exact language
// names and pinned versions.
//
// ⚠️ "javascript" was MISSING from this map entirely before this fix - any
// JavaScript-based question (Frontend/React/Node.js roles, plus anyone who
// picked JS elsewhere) was silently hitting the "Unsupported language"
// fallback below for both Run and grading. That's fixed here.
//
// Versions below are confirmed against a real `ppman install`'d Piston
// instance (via GET /api/v2/runtimes) - not guesses. If you reinstall
// Piston fresh or add a language on a different machine, re-check with:
//   Invoke-RestMethod http://localhost:2000/api/v2/runtimes
// and update any entry that doesn't match, or Piston will reject the
// request with "<language>-<version> runtime is unknown".
const PISTON_RUNTIMES = {
  python:     { language: "python",     version: "3.12.0" },
  javascript: { language: "javascript", version: "20.11.1" },
  typescript: { language: "typescript", version: "5.0.3" },
  c:          { language: "c",          version: "10.2.0" },
  cpp:        { language: "c++",        version: "10.2.0" },
  java:       { language: "java",       version: "15.0.2" },
  csharp:     { language: "csharp",     version: "6.12.0" },
  go:         { language: "go",         version: "1.16.2" },
  kotlin:     { language: "kotlin",     version: "1.8.20" }
};

// Java requires the filename to match the public class name.
// For all other languages the filename doesn't matter, but being
// explicit makes Piston's error messages more readable.
const PISTON_FILENAMES = {
  python:     "solution.py",
  javascript: "solution.js",
  typescript: "solution.ts",
  c:          "solution.c",
  cpp:        "solution.cpp",
  java:       "Main.java",
  csharp:     "Solution.cs",
  go:         "solution.go",
  kotlin:     "Main.kt"
};

// Shared by /run-code (one manual run against the visible example) and
// /submit-test's hidden-test grading loop (many automated runs, one per
// hidden case) - same execution path either way, just different stdin.
async function runOnPiston(language, code, stdin = "") {
  const runtime = PISTON_RUNTIMES[language];
  if (!runtime) {
    return { output: `Unsupported language: ${language}`, ok: false };
  }

  try {
    const response = await axios.post(
      PISTON_URL,
      {
        language: runtime.language,
        version:  runtime.version,
        files: [{ name: PISTON_FILENAMES[language], content: code }],
        stdin
        // No timeout overrides - Piston uses its own configured defaults
        // (3000ms run, 3000ms compile based on what the container reported)
      },
      { timeout: 30000 } // axios timeout - covers compile + run total
    );

    const result = response.data;

    // Piston separates compile-stage output (stderr from gcc/javac/mcs)
    // from run-stage output. We want to show both to the candidate:
    // compile errors are the most useful feedback when their code won't run.
    const compileOutput = result.compile ? result.compile.stderr || "" : "";
    const runOutput     = result.run     ? result.run.output     || "" : "";

    const output = compileOutput
      ? `Compilation error:\n${compileOutput}`
      : runOutput || "No output";

    return { output, ok: !compileOutput };
  } catch (err) {
    // Piston puts the actual reason for a rejection (wrong language/version,
    // bad request shape, etc.) in the response BODY, not in err.message -
    // axios's err.message is just a generic "Request failed with status
    // code 400" that tells you nothing. Logging err.response.data is what
    // actually explains a 400/422 here.
    console.error("Piston execution error:", err.message);
    if (err.response) {
      console.error("Piston response body:", JSON.stringify(err.response.data));
    }

    if (err.code === "ECONNREFUSED") {
      return { output: "Code execution service is not running. Is Docker/Piston up?", ok: false };
    }

    const pistonMessage = err.response?.data?.message;
    if (pistonMessage) {
      // Most common case: "language/version not found" - the version in
      // PISTON_RUNTIMES above doesn't match what's actually installed.
      // Run `Invoke-RestMethod http://localhost:2000/api/v2/runtimes` and
      // update the matching entry above to fix this.
      return { output: `Execution error: ${pistonMessage}`, ok: false };
    }

    return { output: "Execution error: " + err.message, ok: false };
  }
}

app.post("/run-code", requireAuth, async (req, res) => {
  const { code, language, stdin } = req.body;
  const { output } = await runOnPiston(language, code, stdin || "");
  res.json({ output });
});

// Runs code against every hidden test case for a question, sequentially
// and tolerantly - a single Piston hiccup on one case just counts as a
// miss rather than failing the whole grading pass. Shared by /run-tests
// (candidate clicking "Run" mid-test, for feedback) and /submit-test
// (final grading at the end) so there's exactly one place this logic lives.
async function gradeAgainstHiddenTests(testId, language, code) {
  if (!testId) return { testsPassed: 0, testsTotal: 0, results: [] };

  try {
    const generatedTest = await GeneratedTest.findById(testId).lean();
    const cases = generatedTest?.testCases || [];

    // Run all cases concurrently rather than one-at-a-time - this now runs
    // on every "Run" click (not just once at final submission), so total
    // latency matters much more than it used to. Promise.all preserves
    // order regardless of which finishes first, so `results[i]` still maps
    // to test case i correctly.
    const outcomes = await Promise.all(
      cases.map(async (testCase) => {
        const { output, ok } = await runOnPiston(language, code, testCase.input);
        return ok && output.trim() === (testCase.output || "").trim();
      })
    );

    return {
      testsPassed: outcomes.filter(Boolean).length,
      testsTotal: cases.length,
      results: outcomes
    };
  } catch (err) {
    console.error(`Grading failed for testId ${testId}:`, err.message);
    return { testsPassed: 0, testsTotal: 0, results: [] };
  }
}

// ================= RUN AGAINST HIDDEN TESTS (PROTECTED) =================
// Lets the candidate see "9/12 hidden tests passed" while they're still
// working on a question, not just after final submission - same grading
// path as /submit-test, just triggered manually and repeatable. Never
// returns the hidden inputs/outputs themselves, only pass/fail counts and
// a per-case boolean list (so the UI can show which case numbers failed
// without revealing what was actually being tested).
app.post("/run-tests", requireAuth, async (req, res) => {
  const { testId, code, language } = req.body;
  if (!testId) {
    return res.status(400).json({ success: false, message: "Missing testId" });
  }
  const { testsPassed, testsTotal, results } = await gradeAgainstHiddenTests(testId, language, code);
  res.json({ success: true, testsPassed, testsTotal, results });
});

// ================= SUBMIT TEST RESULT (PROTECTED) =================
app.post("/submit-test", requireAuth, async (req, res) => {
  try {
    const { role, testTimeHours, answers, violations, autoSubmitted, startedAt } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: "answers must be an array" });
    }

    // Real grading: run each answer's submitted code once per hidden test
    // case (looked up server-side by testId - the candidate never saw
    // these) and count how many produce the expected output. This replaces
    // the old "compare last Run output to a single expectedOutput" hint,
    // which only reflected whatever the candidate happened to last click
    // Run on.
    const scoredAnswers = await Promise.all(answers.map(async (a) => {
      const { testsPassed, testsTotal } = await gradeAgainstHiddenTests(a.testId, a.language, a.submittedCode);

      // Drop testId and example/starter fields from what we persist per
      // answer that isn't useful in the saved record - keep the doc lean.
      const { testId, ...rest } = a;
      return { ...rest, testsPassed, testsTotal };
    }));

    const violationDocs = Array.isArray(violations)
      ? violations.map((v) => ({
          reason: typeof v === "string" ? v : v.reason,
          timestamp: v.timestamp ? new Date(v.timestamp) : new Date()
        }))
      : [];

    const result = await TestResult.create({
      user: req.userId,
      role,
      testTimeHours,
      answers: scoredAnswers,
      violations: violationDocs,
      violationCount: violationDocs.length,
      autoSubmitted: !!autoSubmitted,
      startedAt: startedAt ? new Date(startedAt) : undefined
    });

    res.json({ success: true, resultId: result._id });
  } catch (err) {
    console.error("submit-test error:", err.message);
    res.status(500).json({ success: false, message: "Failed to save test result" });
  }
});

// ================= MY RESULTS (PROTECTED) =================
// Returns the logged-in user's own test history, most recent first.
// No route currently exists for an admin/recruiter to view OTHER users'
// results - that needs a role system (see the role-based-access question
// from earlier), which hasn't been added yet.
app.get("/my-results", requireAuth, async (req, res) => {
  try {
    const results = await TestResult.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, results });
  } catch (err) {
    console.error("my-results error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch results" });
  }
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});