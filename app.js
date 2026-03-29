// 1) Put your n8n PRODUCTION webhook URL here (from the Webhook node)
const PROXY_URL = "http://localhost:3000/chat";

// 2) Basic elements
const $messages = document.getElementById("messages");
const $input = document.getElementById("input");
const $send = document.getElementById("send");
const $meta = document.getElementById("meta");
const $error = document.getElementById("error");
const $chips = document.getElementById("chips");

// 3) Session and user identity (simple version)
function getSessionId() {
  let id = localStorage.getItem("it_agent_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("it_agent_session", id);
  }
  return id;
}

function getUserId() {
  let id = localStorage.getItem("it_agent_user");
  if (!id) {
    id = "WEB-" + Math.random().toString(16).slice(2);
    localStorage.setItem("it_agent_user", id);
  }
  return id;
}

function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + (role === "user" ? "user" : "bot");

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (role === "bot") {
    // 1. Safely escape the text first to prevent HTML injection
    const tempDiv = document.createElement("div");
    tempDiv.textContent = text;
    let safeHtml = tempDiv.innerHTML;
    
    // 2. Replace **text** with <strong>text</strong> for bolding
    safeHtml = safeHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    bubble.innerHTML = safeHtml;
  } else {
    // Keep user input strictly as text
    bubble.textContent = text;
  }

  wrap.appendChild(bubble);
  $messages.appendChild(wrap);
  $messages.scrollTop = $messages.scrollHeight;
}

function setChips(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    $chips.style.display = "none";
    $chips.innerHTML = "";
    return;
  }
  $chips.style.display = "flex";
  $chips.innerHTML = "";
  suggestions.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.type = "button";
    btn.textContent = s;
    btn.addEventListener("click", () => {
      $input.value = s;
      sendMessage();
    });
    $chips.appendChild(btn);
  });
}

// n8n sometimes returns an array of items. This normalizes it to a single object.
function normalizeN8nResponse(data) {
  if (Array.isArray(data)) {
    // n8n "Respond to Webhook" can return [{...}] depending on settings
    return data[0] ?? {};
  }
  return data ?? {};
}

async function callWebhook(messageText) {
  const payload = {
    userId: getUserId(),
    sessionId: getSessionId(),
    message: messageText,
    channel: "web",
    timestamp: new Date().toISOString()
  };

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const rawText = await res.text();

  if (!res.ok) {
    const snippet = rawText ? rawText.slice(0, 300) : "(empty body)";
    throw new Error(`Webhook request failed (HTTP ${res.status}). ${snippet}`);
  }

  if (!rawText || rawText.trim() === "") {
    throw new Error("Webhook returned an empty response body (no JSON).");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Webhook did not return JSON. First 300 chars: " + rawText.slice(0, 300));
  }

  return normalizeN8nResponse(parsed);
}

async function sendMessage() {
  const text = $input.value.trim();
  if (!text) return;

  $error.textContent = "";
  setChips([]);

  addMessage("user", text);
  $input.value = "";

  $send.disabled = true;
  $meta.textContent = "Sending...";

  try {
    const data = await callWebhook(text);

    // 1. Check if the response is nested inside an 'output' object
    const responseData = data.output ? data.output : data;

    // 2. Grab the text from the correct level
    const replyText = String(responseData.display_text ?? responseData.answer ?? responseData.replyText ?? "");
    const reply = replyText.replace(/^=\s*/, "").trim() || "No replyText returned from n8n.";

    addMessage("bot", reply);

    // 3. Make sure chips also look at the right level
    setChips(Array.isArray(responseData.suggestions) ? responseData.suggestions : []);

    $meta.textContent = data.type ? "Last response type: " + data.type : "";
  } catch (e) {
    addMessage("bot", "I could not reach the help desk service. Try again.");
    $error.textContent = String(e.message || e);
    $meta.textContent = "";
  } finally {
    $send.disabled = false;
    $input.focus();
  }
}

$send.addEventListener("click", sendMessage);
$input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// Initial message
addMessage("bot", "Hi. Describe your issue and I will search the Knowledge Bank first.");
// Navigate to Modify Ticket page
const modifyTicketBtn = document.getElementById("modifyTicketBtn");

if (modifyTicketBtn) {
  modifyTicketBtn.addEventListener("click", () => {
    window.location.href = "modify-ticket.html";
  });
}