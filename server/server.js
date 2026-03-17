const express = require("express");
const cors = require("cors");

// ✅ Make fetch work in ALL Node versions
// Node 18+ has global fetch. Older versions need node-fetch.
let fetchFn = global.fetch;
if (!fetchFn) {
  fetchFn = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
}

const app = express();

// Allow requests from your web page (127.0.0.1:5500)
app.use(
  cors({
    origin: "http://127.0.0.1:5500",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  })
);

// IMPORTANT: parse JSON body (must be BEFORE app.post)
app.use(express.json({ limit: "1mb" }));

// Handle preflight
app.options("/chat", cors());

// Put your n8n PRODUCTION webhook URL here (double-check spelling)
const N8N_WEBHOOK_URL =
  "https://sltrnddigitallab.app.n8n.cloud/webhook/06a44856-9bfa-4fd2-9f8e-5d93c823a710";

app.post("/chat", async (req, res) => {
  try {
    // 1) Log what came from the browser
    console.log("\n---- /chat hit ----");
    console.log("Incoming headers content-type:", req.headers["content-type"]);
    console.log("Incoming body:", req.body);

    // 2) Forward to n8n
    const n8nRes = await fetchFn(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const raw = await n8nRes.text();

    // 3) Log what came back from n8n
    console.log("n8n status:", n8nRes.status);
    console.log("n8n raw length:", raw.length);
    console.log("n8n raw (first 300 chars):", raw.slice(0, 300));

    // 4) If n8n returned empty, send a helpful JSON error (NOT empty)
    if (!raw || raw.trim() === "") {
      return res.status(502).json({
        replyText: "n8n returned an empty response body.",
        debug: {
          n8nStatus: n8nRes.status,
          note:
            "Your n8n workflow did not send a response. Make sure every branch ends in a Respond to Webhook node and that it returns JSON.",
        },
      });
    }

    // 5) Return JSON if possible, else return raw text
    try {
      const json = JSON.parse(raw);
      return res.status(n8nRes.status).json(json);
    } catch {
      res.set("Content-Type", "text/plain; charset=utf-8");
      return res.status(n8nRes.status).send(raw);
    }
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({
      replyText: "Proxy error: could not reach n8n.",
      error: String(err?.message || err),
    });
  }
});

app.listen(3000, () => {
  console.log("Proxy running on http://localhost:3000/chat");
});
