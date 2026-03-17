import { useState, useRef, useCallback } from "react";

const SUMMARY_FORMATS = {
  bullets: {
    label: "Key Findings",
    icon: "◆",
    prompt: `Summarize this research paper as a concise list of key findings and contributions. Format:
## Key Findings
- (5-8 bullet points of the most important findings, each 1-2 sentences)

## Technical Contributions
- (3-5 bullet points on novel methods or approaches)

## Limitations & Future Work
- (2-4 bullet points)`,
  },
  structured: {
    label: "Full Breakdown",
    icon: "▦",
    prompt: `Provide a structured academic summary of this research paper. Format with these exact sections:
## Problem Statement
(1-2 paragraphs: what problem does this paper address and why it matters)

## Methodology
(2-3 paragraphs: the approach, models, datasets, experimental setup)

## Key Results
(1-2 paragraphs with specific numbers/metrics where available)

## Significance
(1 paragraph: why this matters to the field)

## Limitations & Future Directions
(1 paragraph)`,
  },
  paragraph: {
    label: "Quick Summary",
    icon: "¶",
    prompt: `Write a concise 2-3 paragraph plain-language summary of this research paper. 
Paragraph 1: What problem the paper tackles and why it matters.
Paragraph 2: The key approach and main results.
Paragraph 3: The broader implications and takeaways.
Avoid jargon where possible. A smart non-specialist should be able to understand it.`,
  },
};

function parseMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/## (.+)/g, '<h2 class="summary-h2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\- (.+)/gm, '<li class="summary-li">$1</li>');
  html = html.replace(
    /((?:<li class="summary-li">.*<\/li>\n?)+)/g,
    '<ul class="summary-ul">$1</ul>'
  );
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (
        !trimmed ||
        trimmed.startsWith("<h2") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<li")
      )
        return trimmed;
      return `<p class="summary-p">${trimmed}</p>`;
    })
    .join("\n");
  return html;
}

export default function App() {
  const [mode, setMode] = useState("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState("structured");
  const [summary, setSummary] = useState("");
  const [paperTitle, setPaperTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const fileInputRef = useRef(null);

  const loadingMessages = [
    "Reading the abstract…",
    "Parsing methodology section…",
    "Extracting key results…",
    "Distilling the findings…",
    "Polishing the summary…",
  ];

  const rotateMsgs = useCallback(() => {
    let i = 0;
    setLoadingMsg(loadingMessages[0]);
    return setInterval(() => {
      i = (i + 1) % loadingMessages.length;
      setLoadingMsg(loadingMessages[i]);
    }, 3200);
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      setFileName(f.name);
      setError("");
    } else {
      setError("Please upload a PDF file.");
    }
  };

  const fileToBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(f);
    });

  const summarize = async () => {
    setError("");
    setSummary("");
    setPaperTitle("");

    if (mode === "url" && !url.trim()) {
      setError("Please enter an ArXiv URL.");
      return;
    }
    if (mode === "upload" && !file) {
      setError("Please upload a PDF file.");
      return;
    }

    setLoading(true);
    const interval = rotateMsgs();

    try {
      const formatPrompt = SUMMARY_FORMATS[format].prompt;
      let body = {};

      if (mode === "url") {
        body = { mode: "url", url: url.trim(), formatPrompt };
      } else {
        const base64 = await fileToBase64(file);
        body = { mode: "upload", pdfBase64: base64, formatPrompt };
      }

      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      const { title, summary: summaryText } = data;
      if (title) setPaperTitle(title);
      setSummary(summaryText);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const downloadSummary = () => {
    const plainText = summary
      .replace(/## (.+)/g, "\n$1\n" + "=".repeat(40))
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/^\- /gm, "• ");
    const content = `${paperTitle ? paperTitle + "\n" + "=".repeat(paperTitle.length) + "\n\n" : ""}${plainText}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${paperTitle ? paperTitle.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 50).trim().replace(/ /g, "_") : "summary"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadMarkdown = () => {
    const content = `# ${paperTitle || "Paper Summary"}\n\n${summary}`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${paperTitle ? paperTitle.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 50).trim().replace(/ /g, "_") : "summary"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=DM+Sans:wght@400;500;600&display=swap');
        
        * { box-sizing: border-box; }
        
        .summary-h2 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 1.3rem;
          color: #1a1a1a;
          margin: 1.8rem 0 0.7rem 0;
          padding-bottom: 0.35rem;
          border-bottom: 1px solid #e8e0d4;
        }
        .summary-h2:first-child { margin-top: 0; }
        .summary-p {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.92rem;
          line-height: 1.75;
          color: #2c2c2c;
          margin: 0.6rem 0;
        }
        .summary-ul {
          list-style: none;
          padding: 0;
          margin: 0.5rem 0;
        }
        .summary-li {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.92rem;
          line-height: 1.7;
          color: #2c2c2c;
          padding: 0.4rem 0 0.4rem 1.4rem;
          position: relative;
        }
        .summary-li::before {
          content: '◇';
          position: absolute;
          left: 0;
          color: #8b6f47;
          font-size: 0.7rem;
          top: 0.55rem;
        }
        
        .input-field:focus {
          outline: none;
          border-color: #8b6f47;
          box-shadow: 0 0 0 3px rgba(139,111,71,0.1);
        }

        .mode-btn {
          padding: 0.5rem 1.2rem;
          border: 1.5px solid #d4ccc0;
          background: transparent;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem;
          font-weight: 500;
          color: #666;
          transition: all 0.2s;
          border-radius: 0;
        }
        .mode-btn:first-child { border-radius: 6px 0 0 6px; }
        .mode-btn:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
        .mode-btn.active {
          background: #1a1a1a;
          border-color: #1a1a1a;
          color: #fff;
        }

        .format-btn {
          flex: 1;
          padding: 0.65rem 0.5rem;
          border: 1.5px solid #d4ccc0;
          background: #faf8f5;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 500;
          color: #555;
          transition: all 0.2s;
          border-radius: 8px;
          text-align: center;
        }
        .format-btn:hover { border-color: #8b6f47; }
        .format-btn.active {
          background: #f5efe6;
          border-color: #8b6f47;
          color: #1a1a1a;
        }

        .go-btn {
          width: 100%;
          padding: 0.85rem;
          background: #1a1a1a;
          color: #faf8f5;
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s;
          letter-spacing: 0.02em;
        }
        .go-btn:hover:not(:disabled) { background: #333; transform: translateY(-1px); }
        .go-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .dl-btn {
          padding: 0.5rem 1rem;
          border: 1.5px solid #d4ccc0;
          background: #faf8f5;
          border-radius: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.8rem;
          font-weight: 500;
          color: #555;
          cursor: pointer;
          transition: all 0.2s;
        }
        .dl-btn:hover { border-color: #8b6f47; color: #1a1a1a; }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .upload-zone {
          border: 2px dashed #d4ccc0;
          border-radius: 10px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #fdfcfa;
        }
        .upload-zone:hover {
          border-color: #8b6f47;
          background: #faf6ef;
        }
      `}</style>

      <div style={styles.header}>
        <div style={styles.headerAccent} />
        <h1 style={styles.title}>Paper Lens</h1>
        <p style={styles.subtitle}>
          Distill ArXiv papers into clear, actionable summaries
        </p>
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.2rem" }}>
          <button className={`mode-btn ${mode === "url" ? "active" : ""}`} onClick={() => setMode("url")}>
            Paste URL
          </button>
          <button className={`mode-btn ${mode === "upload" ? "active" : ""}`} onClick={() => setMode("upload")}>
            Upload PDF
          </button>
        </div>

        {mode === "url" ? (
          <input
            className="input-field"
            type="text"
            placeholder="https://arxiv.org/abs/2301.12345"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            style={styles.input}
          />
        ) : (
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: "1.8rem", marginBottom: "0.4rem", opacity: 0.5 }}>
              {fileName ? "📄" : "↑"}
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.88rem",
              color: fileName ? "#1a1a1a" : "#888",
              fontWeight: fileName ? 500 : 400,
            }}>
              {fileName || "Click to upload a PDF"}
            </div>
          </div>
        )}

        <div style={{ marginTop: "1.2rem" }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "#999",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "0.5rem",
          }}>
            Summary Format
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {Object.entries(SUMMARY_FORMATS).map(([key, { label, icon }]) => (
              <button
                key={key}
                className={`format-btn ${format === key ? "active" : ""}`}
                onClick={() => setFormat(key)}
              >
                <span style={{ marginRight: "0.35rem" }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "1.2rem" }}>
          <button className="go-btn" onClick={summarize} disabled={loading}>
            {loading ? "Analyzing…" : "Summarize Paper"}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}
      </div>

      {loading && (
        <div style={styles.loadingCard}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <div style={{
              width: 8, height: 8,
              borderRadius: "50%",
              background: "#8b6f47",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.88rem",
              color: "#8b6f47",
              fontWeight: 500,
            }}>
              {loadingMsg}
            </span>
          </div>
        </div>
      )}

      {summary && !loading && (
        <div style={styles.resultCard}>
          {paperTitle && <h2 style={styles.paperTitle}>{paperTitle}</h2>}
          <div dangerouslySetInnerHTML={{ __html: parseMarkdown(summary) }} />
          <div style={styles.downloadBar}>
            <button className="dl-btn" onClick={downloadSummary}>↓ Download .txt</button>
            <button className="dl-btn" onClick={downloadMarkdown}>↓ Download .md</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f5f1eb 0%, #ece6db 100%)",
    padding: "2rem 1rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  header: { textAlign: "center", marginBottom: "1.5rem", position: "relative" },
  headerAccent: { width: 28, height: 3, background: "#8b6f47", margin: "0 auto 1rem", borderRadius: 2 },
  title: {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontSize: "2.4rem",
    fontWeight: 400,
    color: "#1a1a1a",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.92rem",
    color: "#888",
    marginTop: "0.4rem",
    fontWeight: 400,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    borderRadius: 14,
    padding: "1.5rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
  },
  input: {
    width: "100%",
    padding: "0.75rem 1rem",
    border: "1.5px solid #d4ccc0",
    borderRadius: 10,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.9rem",
    color: "#1a1a1a",
    background: "#fdfcfa",
    transition: "all 0.2s",
  },
  error: {
    marginTop: "0.8rem",
    padding: "0.6rem 0.8rem",
    background: "#fdf0ee",
    border: "1px solid #f0ccc7",
    borderRadius: 8,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.82rem",
    color: "#a04030",
  },
  loadingCard: {
    width: "100%",
    maxWidth: 520,
    marginTop: "1rem",
    background: "#fff",
    borderRadius: 14,
    padding: "1.2rem 1.5rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
  },
  resultCard: {
    width: "100%",
    maxWidth: 520,
    marginTop: "1rem",
    background: "#fff",
    borderRadius: 14,
    padding: "1.8rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
  },
  paperTitle: {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontSize: "1.5rem",
    fontWeight: 400,
    color: "#1a1a1a",
    margin: "0 0 1rem 0",
    lineHeight: 1.3,
    paddingBottom: "0.8rem",
    borderBottom: "2px solid #e8e0d4",
  },
  downloadBar: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "1.5rem",
    paddingTop: "1rem",
    borderTop: "1px solid #ece6db",
  },
};
