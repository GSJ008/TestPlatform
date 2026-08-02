import { useEffect, useState, useRef, memo, useCallback } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import * as faceapi from "@vladmandic/face-api";
import { theme } from "./theme";
import { IconShield, IconWarning, IconLock, IconCheckPlain, IconPlay, IconArrowRight } from "./icons";
import CircularTimer from "./CircularTimer";
import Dropdown from "./Dropdown";
import { languagesForRole } from "./languageConfig";
// Device detection (coco-ssd) runs inside proctoring.worker.js, off the main
// thread - it has no DOM dependency so it works fine there.
// Face detection (face-api.js) runs HERE, on the main thread, because the
// library's environment auto-detection cannot succeed inside a Worker (no
// window/document/HTMLImageElement exist there). It's on its own slower
// interval below to keep its cost manageable.

// Monaco language IDs differ slightly from our internal language names
const MONACO_LANGUAGE_MAP = {
  python:     "python",
  javascript: "javascript",
  java:       "java",
  c:          "c",
  cpp:        "cpp",
  csharp:     "csharp"
};

// Returns the starter code for the current question + language.
// If the candidate has already written something for this question, we
// keep their code. Otherwise we use the server-built starter code for this
// exact question (see starterCodeByLanguage in the /generate-questions
// response) - NOT a generic client-side template. That was the actual bug
// behind "the starter code doesn't match the question": this file used to
// have its own separate, generic solve(s)-style template that completely
// ignored what the server sent per question.
function getStarterCode(question, language, existingCode) {
  if (existingCode && existingCode.trim()) return existingCode;
  const byLanguage = question?.starterCodeByLanguage;
  if (byLanguage && byLanguage[language]) return byLanguage[language];
  return "// No starter code available for this question/language.";
}

// Same idea for the code editor itself - memoized so it only re-renders when
// its own props actually change (question switched, language switched),
// not whenever an unrelated piece of parent state (timer, violations,
// monitoring status) updates.
const CodeEditor = memo(function CodeEditor({ language, value, onChange }) {
  return (
    <Editor
      height="380px"
      language={MONACO_LANGUAGE_MAP[language] || language}
      value={value}
      onChange={onChange}
      theme="vs-dark"
      options={{
        fontSize: 14,
        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        lineNumbers: "on",
        glyphMargin: false,
        folding: true,
        automaticLayout: true,
        tabSize: 2,
        // IntelliSense / autocomplete settings
        suggestOnTriggerCharacters: true,
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false
        },
        acceptSuggestionOnEnter: "on",
        tabCompletion: "on",
        parameterHints: { enabled: true },
        suggest: {
          showKeywords: true,
          showSnippets: true,
          showFunctions: true,
          showVariables: true,
          showClasses: true,
          showModules: true,
          insertMode: "replace"
        },
        // Bracket matching and auto-closing
        matchBrackets: "always",
        autoClosingBrackets: "always",
        autoClosingQuotes: "always",
        autoIndent: "full",
        formatOnPaste: true,
        // Scrollbar styling
        scrollbar: {
          vertical: "auto",
          horizontal: "auto",
          useShadows: false
        },
        // Clean look
        renderLineHighlight: "line",
        occurrencesHighlight: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        smoothScrolling: true,
        padding: { top: 16, bottom: 16 }
      }}
    />
  );
});

export default function QuestionPage() {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [violations, setViolations] = useState(0);
  const violationLogRef = useRef([]); // full history: [{ reason, timestamp }]
  const [outputs, setOutputs] = useState({}); // last "Run Code" output per question index
  const [testResults, setTestResults] = useState({}); // { [questionIndex]: { testsPassed, testsTotal, results } }
  const [gradingRun, setGradingRun] = useState(false); // true while hidden tests are being graded after a manual Run
  const startedAtRef = useRef(new Date().toISOString());
  const [timeLeft, setTimeLeft] = useState(3600);
  const totalSecondsRef = useRef(3600);
  const [language, setLanguage] = useState(
    () => localStorage.getItem("selectedLanguage") || "python"
  );
  const [output, setOutput] = useState("");
  const [fullscreenBlocked, setFullscreenBlocked] = useState(false);
  const fullscreenBlockedRef = useRef(false);
  const [monitoringReady, setMonitoringReady] = useState(false);

  const submittedRef = useRef(false);
  const violationPollRef = useRef(null);

  // Proctoring refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const workerRef = useRef(null); // the off-main-thread DEVICE detection worker (coco-ssd only)
  const requestIdRef = useRef(0); // increments per frame sent to the worker
  const monitorIntervalRef = useRef(null); // device detection interval (worker-based)
  const faceCheckIntervalRef = useRef(null); // face detection interval (main thread, face-api)
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioDataRef = useRef(null);

  // ================= LOAD TEST =================
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("questions"));
    const testTime = Number(localStorage.getItem("testTime"));
    const savedLanguage = localStorage.getItem("selectedLanguage");

    if (!data || !data.length) {
      alert("No test data found");
      window.location.href = "/";
      return;
    }

    setQuestions(data);
    setTimeLeft(testTime * 3600);
    totalSecondsRef.current = testTime * 3600 || 3600;
    if (savedLanguage) setLanguage(savedLanguage);
  }, []);

  // ================= TIMER =================
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmitTest(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Keep a ref mirror of fullscreenBlocked - the monitoring setInterval closes
  // over state from when startMonitoring() was first called, so without this
  // it would never see later updates to fullscreenBlocked.
  useEffect(() => {
    fullscreenBlockedRef.current = fullscreenBlocked;
  }, [fullscreenBlocked]);

  // ================= FULLSCREEN ENFORCEMENT =================
  useEffect(() => {
    const handleFs = () => {
      if (!document.fullscreenElement) {
        addViolation("Exited fullscreen");
        setFullscreenBlocked(true);
      }
    };

    // Best-effort attempt - may be blocked since this isn't a direct click handler.
    // The "Re-enter Fullscreen" button below is the reliable path for (re)entry.
    document.documentElement.requestFullscreen().catch(() => {
      setFullscreenBlocked(true);
    });

    document.addEventListener("fullscreenchange", handleFs);
    return () => document.removeEventListener("fullscreenchange", handleFs);
  }, []);

  // ================= TAB SWITCH =================
  useEffect(() => {
    const handleTab = () => {
      if (document.hidden) addViolation("Tab switch detected");
    };

    document.addEventListener("visibilitychange", handleTab);
    return () => document.removeEventListener("visibilitychange", handleTab);
  }, []);

  // ================= BLOCK COPY / PASTE =================
  useEffect(() => {
    const prevent = (e) => {
      e.preventDefault();
      addViolation("Restricted action");
    };

    ["copy", "paste", "cut", "contextmenu"].forEach((e) =>
      document.addEventListener(e, prevent)
    );

    return () =>
      ["copy", "paste", "cut", "contextmenu"].forEach((e) =>
        document.removeEventListener(e, prevent)
      );
  }, []);

  // ================= PROCTORING: LOAD MODELS + CAMERA =================
  useEffect(() => {
    let cancelled = false;

    // Attaches the stream to the <video> element and waits for it to actually
    // start rendering frames before resolving. Doing this with events instead
    // of a bare play() call avoids the race where play() resolves (or silently
    // does nothing) before the element has metadata, which is what produces a
    // "camera is on but shows solid black" result in some browsers.
    const attachStreamToVideo = (stream) =>
      new Promise((resolve, reject) => {
        const video = videoRef.current;
        if (!video) {
          reject(new Error("Video element not mounted"));
          return;
        }

        // Set these imperatively, not just via JSX props - some browsers only
        // honor autoplay-without-gesture if muted/playsInline are already set
        // on the element at the moment srcObject is assigned.
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;

        const onLoadedMetadata = () => {
          video
            .play()
            .then(() => {
              cleanup();
              resolve();
            })
            .catch((err) => {
              cleanup();
              reject(err);
            });
        };

        const onError = (e) => {
          cleanup();
          reject(e);
        };

        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("error", onError);
        };

        video.addEventListener("loadedmetadata", onLoadedMetadata);
        video.addEventListener("error", onError);

        // If metadata is already available (can happen if this effect re-runs
        // after the element already had a stream), fire immediately.
        if (video.readyState >= 1) {
          onLoadedMetadata();
        }
      });

    const setup = async () => {
      let stream;

      // Camera/mic first - this is the part the candidate visually depends on,
      // so get it on screen before spending time loading ML models.
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      } catch (err) {
        console.error("getUserMedia failed:", err);
        addViolation("Camera/microphone unavailable");
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      try {
        await attachStreamToVideo(stream);
      } catch (err) {
        // Camera preview failed to render, but the stream itself is live -
        // detection further below may still work since it reads from the
        // same <video> element's frames once readyState catches up.
        console.error("Video preview failed to start:", err);
      }

      try {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        audioDataRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      } catch (err) {
        console.error("Audio analysis setup failed:", err);
      }

      // DEVICE detection models (coco-ssd) load inside the Worker, off the
      // main thread. The inline `new Worker(new URL(...))` form below is
      // required as-is; webpack can't resolve this if the URL is built from
      // a variable instead.
      try {
        workerRef.current = new Worker(
          new URL("./proctoring.worker.js", import.meta.url)
        );

        workerRef.current.onerror = (err) => {
          console.error("[proctoring] worker-level error:", err.message, err);
        };

        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            workerRef.current.removeEventListener("message", onMessage);
            reject(new Error("Device-detection model loading timed out after 20s"));
          }, 20000);

          const onMessage = (e) => {
            if (e.data.type === "models-ready") {
              clearTimeout(timeoutId);
              workerRef.current.removeEventListener("message", onMessage);
              resolve();
            }
            if (e.data.type === "models-error") {
              clearTimeout(timeoutId);
              workerRef.current.removeEventListener("message", onMessage);
              reject(new Error(e.data.error));
            }
          };
          workerRef.current.addEventListener("message", onMessage);

          workerRef.current.postMessage({ type: "load-models" });
        });
      } catch (err) {
        console.error("Device-detection model loading failed:", err);
        addViolation("Device monitoring unavailable");
      }

      // FACE detection (face-api.js) loads here, on the main thread - this
      // library cannot run inside a Worker (see proctoring.worker.js comment
      // for why). Loaded after the worker so the heavier of the two doesn't
      // delay the other.
      try {
        const modelUrl = process.env.PUBLIC_URL + "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
      } catch (err) {
        console.error("Face-detection model loading failed:", err);
        addViolation("Face monitoring unavailable");
      }

      if (cancelled) return;

      setMonitoringReady(true);
      startMonitoring();
    };

    setup();

    return () => {
      cancelled = true;
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
      if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  // DEVICE detection (coco-ssd, via Worker) - cell phones, laptops, etc.
  const startDeviceMonitoring = () => {
    workerRef.current.addEventListener("message", (e) => {
      if (e.data.type !== "result") return;
      if (submittedRef.current || fullscreenBlockedRef.current) return;

      const { devices, error } = e.data;

      if (error) {
        console.error("Worker detection error:", error);
        return;
      }

      devices.forEach((cls) => addViolation(`${cls} detected`));
    });

    monitorIntervalRef.current = setInterval(async () => {
      if (submittedRef.current) return;
      if (fullscreenBlockedRef.current) return;
      if (!videoRef.current || videoRef.current.readyState !== 4) return;
      if (!workerRef.current) return;

      try {
        // createImageBitmap on a <video> element is a fast, native browser
        // operation - this is the one piece of frame-capture that still runs
        // on the main thread, but it's cheap compared to actually running
        // coco-ssd inference, which happens entirely inside the worker.
        const bitmap = await createImageBitmap(videoRef.current);
        const requestId = ++requestIdRef.current;

        workerRef.current.postMessage(
          { type: "detect", imageBitmap: bitmap, requestId },
          [bitmap] // transfer ownership instead of copying - faster, and
                    // required since ImageBitmap is a transferable object
        );
      } catch (err) {
        console.error("Frame capture failed:", err);
      }
    }, 1000); // was 2000ms - tightened to a 1-second cadence so a phone or
              // second device has a much smaller window to go unnoticed
  };

  // FACE detection (face-api.js, main thread only - see comment in
  // proctoring.worker.js for why this can't move off-thread). Runs on a
  // longer interval than device detection specifically to limit how often
  // this main-thread-blocking work competes with typing/rendering.
  const startFaceMonitoring = () => {
    faceCheckIntervalRef.current = setInterval(async () => {
      if (submittedRef.current) return;
      if (fullscreenBlockedRef.current) return;
      if (!videoRef.current || videoRef.current.readyState !== 4) return;

      try {
        // { inputSize: 224 } keeps the tiny detector's own internal
        // resolution small - lower than its 416 default - trading a little
        // detection accuracy for noticeably less main-thread time per call.
        const faces = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
        );

        if (submittedRef.current || fullscreenBlockedRef.current) return;

        if (faces.length === 0) {
          addViolation("No face detected");
        } else if (faces.length > 1) {
          addViolation("Multiple faces detected");
        }
      } catch (err) {
        console.error("Face detection tick failed:", err);
      }
    }, 5000); // slower cadence than device detection since this one runs on
              // the main thread and directly competes with typing
  };

  const startMonitoring = () => {
    startDeviceMonitoring();
    startFaceMonitoring();
  };

  // ================= VIOLATIONS =================
  // Throttle repeated identical reasons so one ongoing condition (e.g. staying
  // out of frame) doesn't spam a violation every single 1-second tick.
  const lastViolationRef = useRef({ reason: null, time: 0 });

  // Non-blocking banner instead of alert() - alert() is a native blocking
  // dialog, and several browsers automatically exit fullscreen the instant
  // one appears. That was the actual cause of the "exits fullscreen on every
  // violation, then can't recover" loop: each violation's alert() silently
  // kicked the page out of fullscreen, which logged ANOTHER violation, whose
  // alert() did the same thing again, forever.
  const [banner, setBanner] = useState(null);
  const bannerTimeoutRef = useRef(null);

  const showBanner = (text) => {
    setBanner(text);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setBanner(null), 4000);
  };

  const addViolation = (reason) => {
    if (submittedRef.current) return;

    const now = Date.now();
    const last = lastViolationRef.current;
    if (last.reason === reason && now - last.time < 8000) return;
    lastViolationRef.current = { reason, time: now };

    violationLogRef.current.push({ reason, timestamp: new Date().toISOString() });

    setViolations((prev) => {
      const count = prev + 1;
      showBanner(`Violation ${count}/5: ${reason}`);

      if (count >= 5) {
        showBanner("Too many violations. Test auto-submitted.");
        handleSubmitTest(true);
      }

      return count;
    });
  };

  // ================= RE-ENTER FULLSCREEN =================
  const reEnterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenBlocked(false);
    } catch {
      alert("Fullscreen permission is mandatory.");
    }
  };

  // ================= RUN CODE =================
  const runCode = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setOutput("You must be logged in to run code.");
      return;
    }

    const code = getStarterCode(questions[current], language, answers[current]);
    const testId = questions[current].testId;

    // Fire both requests together rather than one after another - the
    // hidden-test grading (up to 12 Piston runs, now parallelized
    // server-side) would otherwise add its own visible delay on top of the
    // quick example run the candidate is used to seeing almost instantly.
    const runPromise = axios.post(
      `${process.env.REACT_APP_API_URL}/run-code`,
      {
        code,
        language,
        // Starter code reads its input from stdin (so the exact same
        // code can later be re-run against the 12 hidden test cases at
        // grading time) - "Run" feeds it the one example the candidate
        // can actually see, as a quick sanity check.
        stdin: questions[current].exampleInput || ""
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    try {
      const res = await runPromise;
      const lastOutput = res.data.output || "";
      setOutput(lastOutput);
      setOutputs((prev) => ({ ...prev, [current]: lastOutput }));
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setOutput("Your session has expired. Please log in again.");
      } else {
        setOutput("Execution error");
      }
    }

    // Hidden-test grading on every Run, not just at final submission - so
    // the candidate can see "9/12 passed" while they're still working
    // instead of finding out only after they submit the whole test.
    if (testId) {
      setGradingRun(true);
      try {
        const testRes = await axios.post(
          `${process.env.REACT_APP_API_URL}/run-tests`,
          { testId, code, language },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTestResults((prev) => ({
          ...prev,
          [current]: {
            testsPassed: testRes.data.testsPassed,
            testsTotal: testRes.data.testsTotal,
            results: testRes.data.results || []
          }
        }));
      } catch (err) {
        console.error("Hidden test grading failed:", err.message);
      } finally {
        setGradingRun(false);
      }
    }
  };

  // ================= ANSWER =================
  // useCallback + functional setState keeps this function reference stable
  // across re-renders (it only changes when the question index changes),
  // which lets the memoized CodeEditor below skip re-rendering on every
  // unrelated parent state update (timer ticks, violation counts, etc).
  const handleChange = useCallback((value) => {
    setAnswers((prev) => ({ ...prev, [current]: value }));
  }, [current]);

  // ================= FINAL SUBMIT =================
  const handleSubmitTest = async (autoSubmitted = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());

    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role") || "Unknown";
    const testTimeHours = Number(localStorage.getItem("testTime")) || null;

    const payloadAnswers = questions.map((q, i) => ({
      title: q.title,
      question: q.question,
      example: q.example,
      submittedCode: answers[i] || getStarterCode(q, language, null),
      language, // NOTE: this is the language currently selected in the UI,
                // not necessarily what each individual question was last run
                // with - acceptable for now since this is a single shared
                // dropdown, but worth revisiting if per-question languages
                // are ever supported.
      actualOutput: outputs[i] || "",
      // testId points at this question's 12 hidden test cases, stored
      // server-side only - the server grades submittedCode against them
      // at /submit-test. We never had (and still don't have) the actual
      // hidden cases on the client.
      testId: q.testId
    }));

    if (token) {
      try {
        await axios.post(
          `${process.env.REACT_APP_API_URL}/submit-test`,
          {
            role,
            testTimeHours,
            answers: payloadAnswers,
            violations: violationLogRef.current,
            autoSubmitted,
            startedAt: startedAtRef.current
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (err) {
        // Don't block the candidate from finishing just because saving
        // failed - log it so you (the developer) notice during testing,
        // but still let them exit cleanly.
        console.error("Failed to save test result:", err);
      }
    } else {
      console.warn("No auth token - test result was not saved.");
    }

    console.log("Final Answers:", answers);
    console.log("Violations:", violationLogRef.current);

    localStorage.clear();
    alert(
      autoSubmitted
        ? "Too many violations. Test auto-submitted."
        : "Test submitted successfully"
    );
    window.location.href = "/";
  };

  // ================= RENDER =================
  // The <video> element is rendered unconditionally below, outside of any
  // early-return branch. Previously it only appeared once `questions` had
  // loaded, which meant videoRef.current was null while getUserMedia() was
  // already running - the stream had nowhere valid to attach to, producing
  // a "camera light is on but the preview is black" result. Loading and
  // fullscreen-blocked states are now rendered as overlays on top instead.

  const showLoading = !questions.length;

  const difficultyColor = (title) => {
    if (!title) return "#64748b";
    const t = title.toLowerCase();
    if (t.includes("easy")) return "#22c55e";
    if (t.includes("medium")) return "#f59e0b";
    if (t.includes("hard")) return "#ef4444";
    return "#64748b";
  };

  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      background: theme.bgGradient,
      color: theme.text,
      fontFamily: theme.fontSans
    }}>
      {/* Camera preview - always mounted so the stream has a stable target */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          width: 140,
          height: 105,
          border: `1px solid ${theme.surfaceBorderStrong}`,
          borderRadius: theme.radiusMd,
          background: "#000",
          objectFit: "cover",
          zIndex: 1000,
          boxShadow: theme.shadowCard
        }}
      />

      {/* Violation banner */}
      {banner && (
        <div style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1a1113",
          border: `1px solid rgba(229,85,95,0.4)`,
          color: theme.text,
          padding: "12px 22px",
          borderRadius: theme.radiusMd,
          zIndex: 2000,
          fontWeight: 600,
          fontSize: 13,
          fontFamily: theme.fontSans,
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: theme.shadowFloating,
          whiteSpace: "nowrap"
        }}>
          <IconWarning size={16} style={{ color: theme.danger }} />
          {banner}
        </div>
      )}

      {/* Fullscreen blocked overlay */}
      {fullscreenBlocked && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: theme.bgGradient,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", textAlign: "center"
        }}>
          <div style={{
            width: 76, height: 76, borderRadius: "50%",
            background: theme.panel, border: `1px solid ${theme.surfaceBorderStrong}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 24, boxShadow: theme.shadowRaised, color: theme.danger
          }}>
            <IconLock size={30} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: theme.text, marginBottom: 12, fontFamily: theme.fontSans }}>
            Fullscreen required
          </h1>
          <p style={{ color: theme.textMuted, marginBottom: 32, maxWidth: 380, lineHeight: 1.6 }}>
            You exited fullscreen. This has been recorded as a violation.
            Return to fullscreen to continue the test.
          </p>
          <button
            className="elev-btn"
            onClick={reEnterFullscreen}
            style={{
              padding: "14px 32px", fontSize: 15, fontWeight: 600,
              background: theme.accentGradient,
              fontFamily: theme.fontSans,
              color: "white", border: "none", borderRadius: theme.radiusMd, cursor: "pointer",
              boxShadow: theme.shadowButton + ", " + theme.shadowGlow,
              display: "inline-flex", alignItems: "center", gap: 8
            }}
          >
            Re-enter fullscreen <IconArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {!fullscreenBlocked && showLoading && (
        <div style={{
          position: "fixed", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: theme.bg, zIndex: 500
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            border: `3px solid ${theme.surfaceBorder}`, borderTopColor: theme.accent,
            marginBottom: 20, animation: "spin 0.9s linear infinite"
          }} />
          <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
          <h2 style={{ color: theme.text, marginBottom: 8, fontFamily: theme.fontSans, fontWeight: 700 }}>Loading your test</h2>
          <p style={{ color: theme.textFaint }}>Setting up proctoring and AI monitoring</p>
        </div>
      )}

      {/* Main test UI */}
      {!fullscreenBlocked && !showLoading && (
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

          {/* LEFT SIDEBAR */}
          <div style={{
            width: 224,
            background: theme.panel,
            borderRight: `1px solid ${theme.surfaceBorder}`,
            boxShadow: "2px 0 12px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            padding: "22px 14px",
            flexShrink: 0,
            zIndex: 2
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18, paddingLeft: 8 }}>
              Questions
            </div>

            {questions.map((q, i) => (
              <button
                key={i}
                className="elev-card"
                onClick={() => setCurrent(i)}
                disabled={i > current + 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "11px 12px",
                  marginBottom: 6,
                  background: current === i
                    ? theme.accentSoft
                    : "transparent",
                  border: current === i
                    ? `1px solid ${theme.accentBorder}`
                    : "1px solid transparent",
                  borderRadius: theme.radiusMd,
                  color: i > current + 1 ? theme.textFaint : theme.text,
                  cursor: i > current + 1 ? "not-allowed" : "pointer",
                  textAlign: "left",
                  fontSize: 13,
                  fontFamily: theme.fontSans,
                  transition: "background 0.15s ease"
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: current === i ? theme.accentGradient : "rgba(255,255,255,0.06)",
                  boxShadow: current === i ? theme.shadowButton : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  color: current === i ? "white" : theme.textMuted
                }}>
                  {i + 1}
                </span>
                <span style={{ color: difficultyColor(q.title), fontSize: 12, fontWeight: 600 }}>
                  {q.title || `Q${i + 1}`}
                </span>
              </button>
            ))}

            <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${theme.surfaceBorder}` }}>
              {!monitoringReady && (
                <div style={{ fontSize: 11, color: theme.textFaint, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <IconShield size={13} />
                  Initializing monitoring...
                </div>
              )}
              {monitoringReady && (
                <div style={{
                  fontSize: 11, color: theme.success, textAlign: "center",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 500
                }}>
                  <IconShield size={13} />
                  Proctoring active
                </div>
              )}
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* TOP BAR */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 24px",
              borderBottom: `1px solid ${theme.surfaceBorder}`,
              background: theme.panel,
              boxShadow: "0 1px 0 rgba(255,255,255,0.03)",
              flexShrink: 0
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: theme.textFaint, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Role</span>
                <span style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>
                  {localStorage.getItem("role") || "Developer"}
                </span>
              </div>

              <CircularTimer seconds={timeLeft} fraction={timeLeft / totalSecondsRef.current} size={56} />

              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: violations > 0 ? theme.dangerSoft : theme.surface,
                border: `1px solid ${violations > 0 ? "rgba(229,85,95,0.35)" : theme.surfaceBorder}`,
                borderRadius: theme.radiusSm, padding: "6px 14px",
                boxShadow: theme.shadowSm
              }}>
                <IconWarning size={14} style={{ color: violations > 0 ? theme.danger : theme.textFaint }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: violations > 0 ? theme.danger : theme.textMuted }}>
                  Violations: {violations}/5
                </span>
              </div>
            </div>

            {/* SPLIT PANE: Question + Editor */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

              {/* QUESTION PANEL */}
              <div style={{
                width: "38%",
                borderRight: `1px solid ${theme.surfaceBorder}`,
                overflowY: "auto",
                padding: "28px 26px",
                background: "rgba(0,0,0,0.12)"
              }}>
                <div style={{ marginBottom: 18 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: difficultyColor(questions[current].title),
                    background: `${difficultyColor(questions[current].title)}18`,
                    border: `1px solid ${difficultyColor(questions[current].title)}30`,
                    padding: "4px 12px", borderRadius: 20
                  }}>
                    {questions[current].title}
                  </span>
                </div>

                <p style={{ fontSize: 15, lineHeight: 1.75, color: theme.text, marginBottom: 22, letterSpacing: "0.005em" }}>
                  {questions[current].question}
                </p>

                <div style={{
                  background: theme.surface,
                  border: `1px solid ${theme.surfaceBorder}`,
                  borderRadius: theme.radiusMd, padding: "14px 16px", marginBottom: 8,
                  boxShadow: theme.shadowRaised
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                    Example
                  </div>
                  {(questions[current].example || "").trim() !== "" ? (
                    <code style={{ fontSize: 13, color: theme.accentBright, lineHeight: 1.7, fontFamily: theme.fontMono, whiteSpace: "pre-wrap" }}>
                      {questions[current].example}
                    </code>
                  ) : (
                    <span style={{ fontSize: 13, color: theme.textFaint, fontStyle: "italic" }}>
                      No example was provided for this question — read the prompt carefully and check your logic against the expected behavior.
                    </span>
                  )}
                </div>

                {/* Output */}
                {output && (
                  <div style={{ marginTop: 22 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: theme.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                      Output
                    </div>
                    <pre style={{
                      background: theme.wellBg,
                      boxShadow: theme.wellShadow,
                      borderRadius: theme.radiusMd, padding: "14px 16px",
                      fontSize: 13, color: theme.success,
                      lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap",
                      fontFamily: theme.fontMono
                    }}>
                      {output}
                    </pre>
                    {questions[current].exampleOutput && (
                      <div style={{ marginTop: 10, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        {output.trim() === questions[current].exampleOutput.trim() ? (
                          <span style={{ color: theme.success, display: "flex", alignItems: "center", gap: 5 }}>
                            <IconCheckPlain size={13} /> Matches the example output
                          </span>
                        ) : (
                          <span style={{ color: theme.warning, display: "flex", alignItems: "center", gap: 5 }}>
                            <IconWarning size={13} /> Differs from the example output
                          </span>
                        )}
                        <span style={{ color: theme.textFaint }}>(this is just the one visible example)</span>
                      </div>
                    )}

                    {/* Hidden test case results - graded on every Run, not just at final submission */}
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: theme.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                        Hidden Test Cases
                      </div>
                      {gradingRun ? (
                        <div style={{ fontSize: 12, color: theme.textFaint, display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 13, height: 13, borderRadius: "50%",
                            border: `2px solid ${theme.surfaceBorder}`, borderTopColor: theme.accent,
                            animation: "spin 0.8s linear infinite"
                          }} />
                          <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
                          Grading against hidden test cases...
                        </div>
                      ) : testResults[current] ? (
                        <div>
                          <div style={{
                            fontSize: 13, fontWeight: 600, marginBottom: 8,
                            color: testResults[current].testsPassed === testResults[current].testsTotal
                              ? theme.success
                              : testResults[current].testsPassed > 0 ? theme.warning : theme.danger,
                            display: "flex", alignItems: "center", gap: 6
                          }}>
                            {testResults[current].testsPassed === testResults[current].testsTotal
                              ? <IconCheckPlain size={13} />
                              : <IconWarning size={13} />}
                            {testResults[current].testsPassed}/{testResults[current].testsTotal} hidden tests passed
                          </div>
                          {testResults[current].results.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {testResults[current].results.map((passed, i) => (
                                <span key={i} title={`Test case ${i + 1}: ${passed ? "passed" : "failed"}`} style={{
                                  width: 22, height: 22, borderRadius: 5,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 10, fontWeight: 700,
                                  background: passed ? theme.successSoft : theme.dangerSoft,
                                  color: passed ? theme.success : theme.danger
                                }}>
                                  {i + 1}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: theme.textFaint }}>
                          Run your code to see how many hidden test cases it passes.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* EDITOR PANEL */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Editor toolbar */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 18px",
                  borderBottom: `1px solid ${theme.surfaceBorder}`,
                  background: theme.panel,
                  boxShadow: "0 1px 0 rgba(255,255,255,0.03)",
                  flexShrink: 0
                }}>
                  <div style={{ width: 150 }}>
                    <Dropdown
                      small
                      value={language}
                      onChange={setLanguage}
                      options={languagesForRole(localStorage.getItem("role"))}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={runCode}
                      style={{
                        padding: "8px 18px",
                        background: theme.panelRaised,
                        display: "flex", alignItems: "center", gap: 7,
                        color: theme.success, border: `1px solid rgba(52,199,147,0.3)`, borderRadius: theme.radiusSm,
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        fontFamily: theme.fontSans, boxShadow: theme.shadowButton
                      }}
                    >
                      <IconPlay size={11} /> Run
                    </button>

                    <button
                      onClick={() => setCurrent((c) => Math.min(c + 1, questions.length - 1))}
                      disabled={current === questions.length - 1}
                      style={{
                        padding: "8px 18px",
                        display: "flex", alignItems: "center", gap: 7,
                        background: current === questions.length - 1
                          ? theme.panelRaised
                          : theme.accentGradient,
                        border: current === questions.length - 1 ? `1px solid ${theme.surfaceBorder}` : "none",
                        color: current === questions.length - 1 ? theme.textFaint : "white",
                        borderRadius: theme.radiusSm, fontSize: 13, fontWeight: 600,
                        fontFamily: theme.fontSans,
                        cursor: current === questions.length - 1 ? "not-allowed" : "pointer",
                        boxShadow: current === questions.length - 1 ? "none" : `${theme.shadowButton}, ${theme.shadowGlow}`
                      }}
                    >
                      Save & Next <IconArrowRight size={13} />
                    </button>

                    <button
                      onClick={() => handleSubmitTest(false)}
                      style={{
                        padding: "8px 18px",
                        background: theme.panelRaised,
                        border: `1px solid rgba(229,85,95,0.3)`,
                        color: theme.danger, borderRadius: theme.radiusSm,
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        fontFamily: theme.fontSans, boxShadow: theme.shadowButton
                      }}
                    >
                      Submit test
                    </button>
                  </div>
                </div>

                {/* Monaco Editor */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <CodeEditor
                    language={language}
                    value={getStarterCode(questions[current], language, answers[current])}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}