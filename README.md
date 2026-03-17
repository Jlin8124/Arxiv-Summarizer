# Paper Lens — ArXiv Summarizer

Distill ArXiv research papers into clear, actionable summaries powered by Gemini.

## Deploy to Vercel (Free)

### Prerequisites
- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (sign up free with GitHub)
- A [Google AI Studio](https://aistudio.google.com) API key (free, no credit card needed)

### Step-by-step

**1. Get your free Gemini API key**

- Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Sign in with your Google account
- Click "Create API key"
- Copy the key and save it somewhere safe

No credit card required. The free tier gives you ~1,000 requests/day.

**2. Push this project to GitHub**

Go to [github.com/new](https://github.com/new) and create a new repository called `paper-lens`.

Then in your terminal:
```bash
cd paper-lens
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/paper-lens.git
git push -u origin main
```

**3. Deploy on Vercel**

- Go to [vercel.com/new](https://vercel.com/new)
- Click "Import Git Repository" and select your `paper-lens` repo
- Under **Framework Preset**, select **Vite**
- Expand **Environment Variables** and add:
  - Key: `GEMINI_API_KEY`
  - Value: your API key from step 1
- Click **Deploy**

That's it! Vercel gives you a free URL like `paper-lens.vercel.app`.

### Custom domain (optional)

In your Vercel project dashboard → Settings → Domains → Add your domain and follow the DNS instructions.

## Local development

```bash
npm install
```

Create a `.env` file from the template:
```bash
cp .env.example .env
# Edit .env and add your Gemini API key
```

Run the dev server:
```bash
npm run dev
```

The app runs at `http://localhost:5173`. To test API routes locally, install the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

## How it works

1. User pastes an ArXiv URL or uploads a PDF
2. For URLs, the server fetches the PDF directly from ArXiv
3. The PDF is sent to Gemini 3 Flash Preview for analysis
4. Gemini returns a structured summary in the chosen format
5. User can download as .txt or .md

## Cost

**Free.** The Gemini API free tier covers ~1,000 requests/day with no credit card. If you outgrow that, Gemini 3 Flash is $0.50/1M input tokens — a typical paper summary costs under $0.01.

## Project structure

```
paper-lens/
├── api/
│   └── summarize.js    ← Serverless function (fetches PDF, calls Gemini)
├── src/
│   ├── App.jsx         ← Main React app
│   └── main.jsx        ← Entry point
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── .env.example
```

## Rate Limiting

API is limited to 3 requests per IP per minute using Upstash Redis + `@upstash/ratelimit` (sliding window).

**To test locally:**
1. Run `vercel dev`
2. In a new terminal, run:
```powershell
1..4 | ForEach-Object {
  $i = $_
  try {
    $r = Invoke-WebRequest -Uri http://localhost:3000/api/summarize -Method POST -ContentType "application/json" -Body '{"mode":"url","url":"https://arxiv.org/abs/2301.12345","formatPrompt":"test"}'
    "Request $i : $($r.StatusCode)"
  } catch {
    "Request $i : $($_.Exception.Response.StatusCode.value__)"
  }
}

