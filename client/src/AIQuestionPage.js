import axios from "axios";
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { theme } from "./theme";
import Dropdown from "./Dropdown";
import { ROLE_LANGUAGES, languagesForRole } from "./languageConfig";
import {
  BrandMark, IconExpand, IconWarning, IconDot, IconArrowRight,
  IconCamera, IconMic, IconCode, IconBriefcase, IconLayers, IconClock, IconCheckPlain, IconShield
} from "./icons";

const ROLES = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "React Developer",
  "Node.js Developer",
  "Python Developer",
  "Java Developer",
  "DevOps Engineer",
  "Data Scientist",
  "Mobile Developer"
];

const S = {
  page: {
    minHeight: "100vh",
    background: theme.bgGradient,
    color: theme.text,
    fontFamily: theme.fontSans,
    display: "flex",
    flexDirection: "column"
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 32px",
    borderBottom: `1px solid ${theme.surfaceBorder}`,
    background: theme.panel,
    boxShadow: theme.shadowSm
  },
  logoRow: { display: "flex", alignItems: "center", gap: 10 },
  logo: { fontSize: 15, fontWeight: 700, color: theme.text, letterSpacing: "-0.2px" },
  navLink: {
    color: theme.textMuted,
    textDecoration: "none",
    fontSize: 13.5,
    fontWeight: 500,
    padding: "8px 16px",
    borderRadius: theme.radiusSm,
    background: theme.panelRaised,
    boxShadow: theme.shadowButton,
    display: "flex",
    alignItems: "center",
    gap: 6
  },
  body: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px"
  },
  shell: {
    width: "100%",
    maxWidth: 920
  },
  header: { textAlign: "center", marginBottom: 28 },
  eyebrow: {
    fontSize: 11.5, fontWeight: 700, color: theme.accentBright,
    letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10
  },
  heading: { fontSize: 27, fontWeight: 700, color: theme.text, letterSpacing: "-0.3px" },
  card: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    background: theme.panel,
    borderRadius: theme.radiusLg,
    boxShadow: theme.shadowCard,
    overflow: "hidden"
  },
  // LEFT: systems check
  checkPane: {
    background: "rgba(0,0,0,0.22)",
    borderRight: `1px solid ${theme.surfaceBorder}`,
    padding: "28px 26px",
    display: "flex",
    flexDirection: "column"
  },
  paneLabel: {
    fontSize: 11, fontWeight: 700, color: theme.textFaint,
    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16
  },
  viewfinder: {
    position: "relative",
    borderRadius: theme.radiusMd,
    overflow: "hidden",
    background: "#000",
    boxShadow: theme.shadowRaised,
    marginBottom: 20,
    aspectRatio: "4 / 3"
  },
  video: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  corner: (pos) => ({
    position: "absolute",
    width: 16, height: 16,
    border: `2px solid ${theme.accentBright}`,
    opacity: 0.85,
    ...(pos === "tl" && { top: 8, left: 8, borderRight: "none", borderBottom: "none" }),
    ...(pos === "tr" && { top: 8, right: 8, borderLeft: "none", borderBottom: "none" }),
    ...(pos === "bl" && { bottom: 8, left: 8, borderRight: "none", borderTop: "none" }),
    ...(pos === "br" && { bottom: 8, right: 8, borderLeft: "none", borderTop: "none" })
  }),
  liveBadge: {
    position: "absolute", top: 10, left: 10,
    background: "rgba(229,85,95,0.92)", color: "white",
    fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 20,
    display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.05em",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
  },
  checklist: { display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" },
  checkItem: (ok) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 12px",
    background: theme.panelRaised,
    borderRadius: theme.radiusSm,
    boxShadow: theme.shadowSm,
    fontSize: 12.5,
    color: ok ? theme.text : theme.textFaint
  }),
  checkIcon: (ok) => ({
    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: ok ? theme.successSoft : "rgba(255,255,255,0.05)",
    color: ok ? theme.success : theme.textFaint
  }),
  // RIGHT: configuration
  configPane: { padding: "30px 32px", display: "flex", flexDirection: "column" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 18, marginBottom: 8 },
  field: { display: "flex", flexDirection: "column", gap: 8 },
  labelRow: { display: "flex", alignItems: "center", gap: 7 },
  label: {
    fontSize: 11.5, fontWeight: 600, color: theme.textMuted,
    letterSpacing: "0.05em", textTransform: "uppercase"
  },
  selectWrap: { position: "relative" },
  select: {
    background: theme.panelFlat,
    border: `1px solid ${theme.surfaceBorder}`,
    boxShadow: theme.shadowSm,
    borderRadius: theme.radiusSm,
    color: theme.text,
    padding: "11px 36px 11px 14px",
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
    width: "100%",
    fontFamily: theme.fontSans,
    WebkitAppearance: "none",
    appearance: "none"
  },
  selectChevron: {
    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
    color: theme.textFaint, pointerEvents: "none"
  },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  noticeBox: {
    background: theme.warningSoft,
    borderRadius: theme.radiusMd,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    padding: "13px 16px",
    marginTop: 20,
    marginBottom: 22,
    fontSize: 12.5,
    color: theme.warning,
    lineHeight: 1.6,
    display: "flex",
    gap: 10
  },
  btn: {
    width: "100%",
    padding: "15px",
    background: theme.accentGradient,
    color: "white",
    border: "none",
    borderRadius: theme.radiusMd,
    fontSize: 15.5,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.01em",
    boxShadow: `${theme.shadowButton}, ${theme.shadowGlow}`,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: "auto"
  },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
  // Fullscreen gate
  gate: {
    position: "fixed", inset: 0, background: theme.bgGradient, color: "white",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    textAlign: "center", padding: 40
  },
  gateIconWrap: {
    width: 84, height: 84, borderRadius: "50%",
    background: theme.panel, boxShadow: theme.shadowRaised,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: theme.accentBright, marginBottom: 28
  },
  gateTitle: { fontSize: 30, fontWeight: 700, marginBottom: 12, color: theme.text, letterSpacing: "-0.3px" },
  gateText: { maxWidth: 440, color: theme.textMuted, fontSize: 15, lineHeight: 1.7, marginBottom: 32 },
  gateBtn: {
    padding: "14px 36px", fontSize: 15.5, fontWeight: 600,
    background: theme.accentGradient, color: "white", border: "none",
    borderRadius: theme.radiusMd, cursor: "pointer",
    boxShadow: `${theme.shadowButton}, ${theme.shadowGlow}`,
    display: "flex", alignItems: "center", gap: 8
  }
};

export default function AIQuestionPage() {
  const [role, setRole] = useState("Frontend Developer");
  const [time, setTime] = useState(1);
  const [language, setLanguage] = useState(ROLE_LANGUAGES["Frontend Developer"][0]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [mediaReady, setMediaReady] = useState(false);

  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const languageOptions = languagesForRole(role);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    const allowed = ROLE_LANGUAGES[newRole] || languageOptions.map((l) => l.value);
    // If the currently selected language doesn't fit the new role, snap to
    // the first valid option instead of leaving an invalid combo selected.
    if (!allowed.includes(language)) {
      setLanguage(allowed[0]);
    }
  };

  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch (err) {
      console.error("requestFullscreen rejected:", err);
      alert("Fullscreen permission is mandatory to take this test.");
      return false;
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-request camera/mic as soon as this page mounts (in fullscreen),
  // so the systems-check panel shows real status rather than a static list.
  useEffect(() => {
    if (isFullscreen && !mediaReady) {
      checkMedia();
    }
  }, [isFullscreen]);

  const checkMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMediaReady(true);
      return true;
    } catch (err) {
      console.error("getUserMedia failed:", err);
      return false;
    }
  };

  const startTest = async () => {
    setLoading(true);

    const fsOk = await requestFullscreen();
    if (!fsOk) { setLoading(false); return; }

    const mediaOk = mediaReady || (await checkMedia());
    if (!mediaOk) {
      alert("Camera and microphone access is mandatory to take this test.");
      setLoading(false);
      return;
    }

    if (!document.fullscreenElement) {
      alert("You must remain in fullscreen to start the test. Please try again.");
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must be logged in to start a test.");
      setLoading(false);
      navigate("/");
      return;
    }

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/generate-questions`,
        { role, language },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.data || res.data.length === 0) {
        alert("No questions generated. Please try again.");
        setLoading(false);
        return;
      }

      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());

      localStorage.setItem("questions", JSON.stringify(res.data));
      localStorage.setItem("testTime", time);
      localStorage.setItem("role", role);
      localStorage.setItem("selectedLanguage", language);
      localStorage.setItem("violation", "");

      navigate("/test");
    } catch (err) {
      console.error("generate-questions failed:", err);
      if (err.response && err.response.status === 401) {
        alert("Your session has expired. Please log in again.");
        localStorage.removeItem("token");
        navigate("/");
      } else {
        alert("Failed to generate questions. Is the server running?");
      }
      setLoading(false);
    }
  };

  // ===== FULLSCREEN GATE =====
  if (!isFullscreen) {
    return (
      <div style={S.gate}>
        <div style={S.gateIconWrap}>
          <IconExpand size={34} />
        </div>
        <h1 style={S.gateTitle}>Fullscreen required</h1>
        <p style={S.gateText}>
          This test must be taken in fullscreen mode to maintain exam integrity.
          Exiting fullscreen at any point during the test will be recorded as a violation.
        </p>
        <button className="elev-btn" style={S.gateBtn} onClick={requestFullscreen}>
          Enter fullscreen to continue <IconArrowRight size={15} />
        </button>
      </div>
    );
  }

  // ===== MAIN UI =====
  return (
    <div style={S.page}>
      <nav style={S.navbar}>
        <div style={S.logoRow}>
          <BrandMark size={26} />
          <span style={S.logo}>AI Test Platform</span>
        </div>
        <Link to="/dashboard" style={S.navLink} className="elev-btn">My Results</Link>
      </nav>

      <div style={S.body}>
        <div style={S.shell}>
          <div style={S.header}>
            <div style={S.eyebrow}>Pre-test systems check</div>
            <h1 style={S.heading}>Configure your assessment</h1>
          </div>

          <div style={S.card}>
            {/* LEFT: camera + status */}
            <div style={S.checkPane}>
              <div style={S.paneLabel}>Camera preview</div>
              <div style={S.viewfinder}>
                <video ref={videoRef} autoPlay muted playsInline style={S.video} />
                <div style={S.corner("tl")} /><div style={S.corner("tr")} />
                <div style={S.corner("bl")} /><div style={S.corner("br")} />
                {mediaReady && (
                  <div style={S.liveBadge}><IconDot size={6} color="#fff" /> LIVE</div>
                )}
                {!mediaReady && (
                  <div style={{
                    position: "absolute", inset: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: theme.textFaint, fontSize: 12, textAlign: "center", padding: 16
                  }}>
                    Requesting camera access...
                  </div>
                )}
              </div>

              <div style={S.checklist}>
                <div style={S.checkItem(isFullscreen)}>
                  <span style={S.checkIcon(isFullscreen)}><IconCheckPlain size={12} /></span>
                  Fullscreen mode
                </div>
                <div style={S.checkItem(mediaReady)}>
                  <span style={S.checkIcon(mediaReady)}><IconCamera size={12} /></span>
                  Camera access
                </div>
                <div style={S.checkItem(mediaReady)}>
                  <span style={S.checkIcon(mediaReady)}><IconMic size={12} /></span>
                  Microphone access
                </div>
                <div style={S.checkItem(true)}>
                  <span style={S.checkIcon(true)}><IconShield size={12} /></span>
                  Proctoring will begin on start
                </div>
              </div>
            </div>

            {/* RIGHT: configuration */}
            <div style={S.configPane}>
              <div style={S.fieldGroup}>
                <div style={S.field}>
                  <div style={S.labelRow}>
                    <IconBriefcase size={13} style={{ color: theme.textFaint }} />
                    <label style={S.label}>Job role</label>
                  </div>
                  <Dropdown
                    value={role}
                    onChange={handleRoleChange}
                    options={ROLES}
                    triggerStyle={{ padding: "11px 14px", fontSize: 14 }}
                  />
                </div>

                <div style={S.twoCol}>
                  <div style={S.field}>
                    <div style={S.labelRow}>
                      <IconCode size={13} style={{ color: theme.textFaint }} />
                      <label style={S.label}>Language</label>
                    </div>
                    <Dropdown
                      value={language}
                      onChange={setLanguage}
                      options={languageOptions}
                      triggerStyle={{ padding: "11px 14px", fontSize: 14 }}
                    />
                  </div>

                  <div style={S.field}>
                    <div style={S.labelRow}>
                      <IconClock size={13} style={{ color: theme.textFaint }} />
                      <label style={S.label}>Duration</label>
                    </div>
                    <Dropdown
                      value={time}
                      onChange={setTime}
                      options={[
                        { value: 1, label: "1 hour" },
                        { value: 2, label: "2 hours" },
                        { value: 3, label: "3 hours" }
                      ]}
                      triggerStyle={{ padding: "11px 14px", fontSize: 14 }}
                    />
                  </div>
                </div>

                <div style={S.field}>
                  <div style={S.labelRow}>
                    <IconLayers size={13} style={{ color: theme.textFaint }} />
                    <label style={S.label}>Difficulty curve</label>
                  </div>
                  <div style={{
                    display: "flex", borderRadius: theme.radiusSm, overflow: "hidden",
                    boxShadow: theme.shadowSm, border: `1px solid ${theme.surfaceBorder}`
                  }}>
                    {[["Easy", theme.success], ["Medium", theme.warning], ["Hard", theme.danger]].map(([label, color], i) => (
                      <div key={label} style={{
                        flex: 1, textAlign: "center", padding: "10px 0", fontSize: 12.5, fontWeight: 600,
                        color, background: theme.panelFlat,
                        borderLeft: i > 0 ? `1px solid ${theme.surfaceBorder}` : "none"
                      }}>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={S.noticeBox}>
                <IconWarning size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Camera, microphone, and fullscreen stay active for the full duration.
                  Tab switching, copy/paste, and device use are monitored — 5 violations auto-submits your test.
                </span>
              </div>

              <button
                className="elev-btn"
                style={{ ...S.btn, ...(loading ? S.btnDisabled : {}) }}
                onClick={startTest}
                disabled={loading}
              >
                {loading ? "Generating questions..." : <>Start secure test <IconArrowRight size={15} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}