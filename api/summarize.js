export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "API key not configured on server." });
  }

  try {
    const { mode, url, pdfBase64, formatPrompt } = req.body;

    if (!formatPrompt) {
      return res.status(400).json({ error: "Missing format prompt." });
    }

    const systemInstruction =
      "You are an expert research paper analyst. Provide clear, accurate summaries. Always start your response with TITLE: followed by the paper title on the first line, then a blank line, then the summary.";

    let parts = [];

    if (mode === "url") {
      if (!url) return res.status(400).json({ error: "Missing URL." });

      // Convert ArXiv URL to PDF URL and fetch it server-side
      const pdfUrl = arxivToPdfUrl(url);
      if (!pdfUrl) {
        return res.status(400).json({
          error: "Please provide a valid ArXiv URL (e.g. https://arxiv.org/abs/2301.12345)",
        });
      }

      try {
        const pdfResponse = await fetch(pdfUrl, {
          headers: { "User-Agent": "PaperLens/1.0" },
          redirect: "follow",
        });

        if (!pdfResponse.ok) {
          return res.status(400).json({
            error: `Could not fetch paper from ArXiv (HTTP ${pdfResponse.status}). Try uploading the PDF instead.`,
          });
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();
        const base64 = Buffer.from(pdfBuffer).toString("base64");

        parts = [
          {
            inline_data: {
              mime_type: "application/pdf",
              data: base64,
            },
          },
          {
            text: `Summarize this research paper.\n\n1. First line: TITLE: <the paper title>\n2. Then a blank line\n3. Then the summary in this format:\n\n${formatPrompt}`,
          },
        ];
      } catch (fetchErr) {
        return res.status(400).json({
          error: "Failed to download paper from ArXiv. Try uploading the PDF instead.",
        });
      }
    } else if (mode === "upload") {
      if (!pdfBase64) return res.status(400).json({ error: "Missing PDF data." });
      if (pdfBase64.length > 20_000_000) {
        return res.status(400).json({ error: "File too large. Max 15MB." });
      }

      parts = [
        {
          inline_data: {
            mime_type: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          text: `Summarize this research paper.\n\n1. First line: TITLE: <the paper title>\n2. Then a blank line\n3. Then the summary in this format:\n\n${formatPrompt}`,
        },
      ];
    } else {
      return res.status(400).json({ error: "Invalid mode." });
    }

    const MODEL = "gemini-3-flash-preview";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.3,
        },
      }),
    });

    const data = await apiResponse.json();

    if (data.error) {
      const msg = data.error.message || "Gemini API error.";
      if (data.error.code === 429) {
        return res.status(429).json({
          error: "Free tier rate limit reached. Please wait a minute and try again.",
        });
      }
      return res.status(500).json({ error: msg });
    }

    // Extract text from Gemini response
    const textContent = data.candidates?.[0]?.content?.parts
      ?.filter((p) => p.text)
      .map((p) => p.text)
      .join("\n");

    if (!textContent) {
      const blockReason = data.candidates?.[0]?.finishReason;
      return res.status(500).json({
        error: blockReason === "SAFETY"
          ? "The response was blocked by safety filters. Try a different paper."
          : "No summary returned. Try uploading the PDF directly.",
      });
    }

    // Parse title from response
    const titleMatch = textContent.match(/^TITLE:\s*(.+)/m);
    let title = "";
    let summary = textContent.trim();

    if (titleMatch) {
      title = titleMatch[1].trim();
      summary = textContent.replace(/^TITLE:\s*.+\n*/, "").trim();
    }

    return res.status(200).json({ title, summary });
  } catch (err) {
    console.error("Summarize error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * Convert various ArXiv URL formats to a direct PDF URL.
 * Handles: arxiv.org/abs/XXXX, arxiv.org/pdf/XXXX, arxiv.org/html/XXXX
 */
function arxivToPdfUrl(input) {
  try {
    const cleaned = input.trim();
    const patterns = [
      /arxiv\.org\/abs\/([^\s?#]+)/,
      /arxiv\.org\/pdf\/([^\s?#]+)/,
      /arxiv\.org\/html\/([^\s?#]+)/,
      /^(\d{4}\.\d{4,5})(v\d+)?$/,
    ];

    for (const pat of patterns) {
      const match = cleaned.match(pat);
      if (match) {
        const id = match[1].replace(/\.pdf$/, "");
        return `https://arxiv.org/pdf/${id}.pdf`;
      }
    }
    return null;
  } catch {
    return null;
  }
}
