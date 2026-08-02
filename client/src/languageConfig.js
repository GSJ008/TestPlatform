// Mirrors LANGUAGE_LABELS / ROLE_LANGUAGES in server/index.js.
// Single source of truth on the client side so AIQuestionPage.js (initial
// config) and QuestionPage.js (in-test language switcher) can't drift out
// of sync with each other - if you add a language here, add its starter
// code generator + Piston runtime entry on the server too.
export const LANGUAGES = [
  { value: "python",     label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java",       label: "Java" },
  { value: "kotlin",     label: "Kotlin" },
  { value: "go",         label: "Go" },
  { value: "cpp",        label: "C++" },
  { value: "c",          label: "C" },
  { value: "csharp",     label: "C#" }
];

export const ROLE_LANGUAGES = {
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

export function languagesForRole(role) {
  const allowed = ROLE_LANGUAGES[role] || LANGUAGES.map((l) => l.value);
  return LANGUAGES.filter((l) => allowed.includes(l.value));
}