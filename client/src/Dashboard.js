import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { theme } from "./theme";
import { BrandMark, IconUser, IconClipboard, IconWarning, IconCheckPlain, IconChevronDown } from "./icons";

const S = {
  page: {
    minHeight: "100vh",
    background: theme.bgGradient,
    color: theme.text,
    fontFamily: theme.fontSans
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 32px",
    borderBottom: `1px solid ${theme.surfaceBorder}`,
    background: theme.panel,
    boxShadow: "0 1px 0 rgba(255,255,255,0.03)",
    position: "sticky",
    top: 0,
    zIndex: 100
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10
  },
  logo: {
    fontSize: 15,
    fontWeight: 700,
    color: theme.text,
    letterSpacing: "-0.2px"
  },
  navRight: {
    display: "flex",
    alignItems: "center",
    gap: 14
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: theme.textMuted
  },
  newTestBtn: {
    padding: "9px 20px",
    background: theme.accentGradient,
    color: "white",
    border: "none",
    borderRadius: theme.radiusSm,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    boxShadow: `${theme.shadowButton}, ${theme.shadowGlow}`
  },
  body: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "40px 20px"
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 6,
    letterSpacing: "-0.3px"
  },
  pageSub: {
    fontSize: 14,
    color: theme.textFaint,
    marginBottom: 32
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 32
  },
  statCard: {
    background: theme.panel,
    borderRadius: theme.radiusMd,
    padding: "20px 24px",
    boxShadow: theme.shadowRaised
  },
  statNum: (accent) => ({
    fontSize: 30,
    fontWeight: 700,
    color: accent,
    marginBottom: 4,
    fontFamily: theme.fontMono
  }),
  statLabel: {
    fontSize: 12.5,
    color: theme.textFaint
  },
  card: (expanded) => ({
    background: theme.panel,
    boxShadow: expanded ? theme.shadowRaised : theme.shadowSm,
    border: expanded ? `1px solid ${theme.accentBorder}` : `1px solid ${theme.surfaceBorder}`,
    borderRadius: theme.radiusMd,
    marginBottom: 12,
    overflow: "hidden",
    transition: "border-color 0.2s, box-shadow 0.2s"
  }),
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 22px",
    cursor: "pointer"
  },
  cardLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 4
  },
  cardRole: {
    fontSize: 15.5,
    fontWeight: 600,
    color: theme.text
  },
  cardDate: {
    fontSize: 12,
    color: theme.textFaint
  },
  cardRight: {
    display: "flex",
    alignItems: "center",
    gap: 10
  },
  badge: (color, bg) => ({
    fontSize: 12,
    fontWeight: 600,
    color: color,
    background: bg,
    padding: "4px 11px",
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    gap: 5
  }),
  expandBody: {
    borderTop: `1px solid ${theme.surfaceBorder}`,
    padding: "20px 22px"
  },
  qCard: {
    background: theme.wellBg,
    boxShadow: theme.wellShadow,
    borderRadius: theme.radiusSm,
    padding: "14px 16px",
    marginBottom: 10
  },
  qTitle: {
    fontSize: 13,
    color: theme.text,
    marginBottom: 8,
    lineHeight: 1.5
  },
  codeBlock: {
    background: "#050608",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 12,
    color: theme.accentBright,
    fontFamily: theme.fontMono,
    whiteSpace: "pre-wrap",
    marginTop: 6,
    maxHeight: 120,
    overflow: "auto"
  },
  outputRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    fontSize: 12
  },
  vioSection: {
    marginTop: 20
  },
  vioTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    color: theme.textFaint,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 8
  },
  vioItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: theme.textMuted,
    padding: "6px 0",
    borderBottom: `1px solid ${theme.surfaceBorder}`
  },
  empty: {
    textAlign: "center",
    padding: "60px 20px",
    color: theme.textFaint
  },
  logoutBtn: {
    padding: "8px 16px",
    background: theme.panelRaised,
    border: `1px solid ${theme.surfaceBorder}`,
    borderRadius: theme.radiusSm,
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: theme.shadowSm
  }
};

const diffColor = (title) => {
  if (!title) return theme.textFaint;
  const t = title.toLowerCase();
  if (t.includes("easy")) return theme.success;
  if (t.includes("medium")) return theme.warning;
  if (t.includes("hard")) return theme.danger;
  return theme.textFaint;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const fetchResults = async () => {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/"); return; }

      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/my-results`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setResults(res.data.results || []);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/");
        } else {
          setError("Failed to load your test history. Is the server running?");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const formatDate = (iso) => iso ? new Date(iso).toLocaleString() : "Unknown";

  // Stats
  const totalTests = results.length;
  const avgViolations = totalTests
    ? Math.round(results.reduce((a, r) => a + r.violationCount, 0) / totalTests * 10) / 10
    : 0;
  const totalTestsPassed = results.reduce((a, r) =>
    a + r.answers.reduce((sum, ans) => sum + (ans.testsPassed || 0), 0), 0);
  const totalTestsPossible = results.reduce((a, r) =>
    a + r.answers.reduce((sum, ans) => sum + (ans.testsTotal || 0), 0), 0);

  if (loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            border: `3px solid ${theme.surfaceBorder}`, borderTopColor: theme.accent,
            margin: "0 auto 18px", animation: "spin 0.9s linear infinite"
          }} />
          <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
          <p style={{ color: theme.textFaint }}>Loading your test history...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <nav style={S.navbar}>
        <div style={S.logoRow}>
          <BrandMark size={26} />
          <span style={S.logo}>AI Test Platform</span>
        </div>
        <div style={S.navRight}>
          {user.name && (
            <span style={S.userRow}>
              <IconUser size={14} /> {user.name}
            </span>
          )}
          <Link to="/ai" style={S.newTestBtn} className="elev-btn">New Test</Link>
          <button className="elev-btn" style={S.logoutBtn} onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div style={S.body}>
        <h1 style={S.pageTitle}>Test History</h1>
        <p style={S.pageSub}>
          {totalTests === 0
            ? "No tests taken yet. Start your first test above."
            : `${totalTests} test${totalTests !== 1 ? "s" : ""} completed`}
        </p>

        {totalTests > 0 && (
          <div style={S.statsRow}>
            <div style={S.statCard}>
              <div style={S.statNum(theme.accentBright)}>{totalTests}</div>
              <div style={S.statLabel}>Tests taken</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statNum(theme.success)}>
                {totalTestsPossible ? `${totalTestsPassed}/${totalTestsPossible}` : "—"}
              </div>
              <div style={S.statLabel}>Hidden test cases passed</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statNum(theme.warning)}>{avgViolations}</div>
              <div style={S.statLabel}>Avg violations / test</div>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: theme.dangerSoft, border: "1px solid rgba(229,85,95,0.35)",
            borderRadius: theme.radiusMd, padding: "12px 16px", color: theme.danger,
            fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 8
          }}>
            <IconWarning size={15} /> {error}
          </div>
        )}

        {!error && totalTests === 0 && (
          <div style={S.empty}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, color: theme.textFaint }}>
              <IconClipboard size={38} />
            </div>
            <p>You haven't completed any tests yet.</p>
            <Link to="/ai" style={{ color: theme.accentBright }}>Start your first test</Link>
          </div>
        )}

        {results.map((r) => {
          const isExpanded = expandedId === r._id;
          const testsPassed = r.answers.reduce((sum, a) => sum + (a.testsPassed || 0), 0);
          const testsTotal = r.answers.reduce((sum, a) => sum + (a.testsTotal || 0), 0);

          return (
            <div key={r._id} className="elev-card" style={S.card(isExpanded)}>
              <div
                style={S.cardHeader}
                onClick={() => setExpandedId(isExpanded ? null : r._id)}
              >
                <div style={S.cardLeft}>
                  <span style={S.cardRole}>{r.role}</span>
                  <span style={S.cardDate}>{formatDate(r.submittedAt)}</span>
                </div>

                <div style={S.cardRight}>
                  {r.autoSubmitted && (
                    <span style={S.badge(theme.danger, theme.dangerSoft)}>
                      Auto-submitted
                    </span>
                  )}
                  <span style={S.badge(
                    r.violationCount === 0 ? theme.success : r.violationCount < 3 ? theme.warning : theme.danger,
                    r.violationCount === 0 ? theme.successSoft : r.violationCount < 3 ? theme.warningSoft : theme.dangerSoft
                  )}>
                    <IconWarning size={11} /> {r.violationCount}/5 violations
                  </span>
                  <span style={S.badge(theme.accentBright, theme.accentSoft)}>
                    <IconCheckPlain size={11} /> {testsPassed}/{testsTotal} tests passed
                  </span>
                  <span style={{
                    color: theme.textFaint,
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s", display: "flex"
                  }}>
                    <IconChevronDown size={15} />
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div style={S.expandBody}>
                  <div style={{
                    fontSize: 11.5, fontWeight: 700, color: theme.textFaint,
                    letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12
                  }}>
                    Answers
                  </div>

                  {r.answers.map((a, i) => (
                    <div key={i} style={S.qCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: diffColor(a.title),
                          background: `${diffColor(a.title)}18`,
                          padding: "2px 8px", borderRadius: 20,
                          textTransform: "uppercase"
                        }}>
                          {a.title}
                        </span>
                        <span style={{ fontSize: 13, color: theme.textMuted }}>Q{i + 1}</span>
                      </div>

                      <div style={S.qTitle}>{a.question}</div>

                      {a.submittedCode && (
                        <div style={S.codeBlock}>{a.submittedCode}</div>
                      )}

                      <div style={S.outputRow}>
                        <span style={{ color: theme.textFaint }}>Last run output:</span>
                        <code style={{ color: theme.accentBright }}>{a.actualOutput || "(not run)"}</code>
                        {a.testsTotal > 0 ? (
                          <span style={{
                            color: a.testsPassed === a.testsTotal ? theme.success : a.testsPassed > 0 ? theme.warning : theme.danger,
                            display: "flex", alignItems: "center", gap: 4
                          }}>
                            <IconCheckPlain size={12} /> {a.testsPassed}/{a.testsTotal} hidden tests passed
                          </span>
                        ) : (
                          <span style={{ color: theme.textFaint }}>— Not graded</span>
                        )}
                      </div>
                    </div>
                  ))}

                  <div style={S.vioSection}>
                    <div style={S.vioTitle}>Violation log</div>
                    {r.violations.length === 0 ? (
                      <p style={{ color: theme.success, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                        <IconCheckPlain size={13} /> No violations recorded
                      </p>
                    ) : (
                      r.violations.map((v, i) => (
                        <div key={i} style={S.vioItem}>
                          <IconWarning size={12} style={{ color: theme.danger }} />
                          <span style={{ color: theme.textFaint }}>{formatDate(v.timestamp)}</span>
                          <span>{v.reason}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}