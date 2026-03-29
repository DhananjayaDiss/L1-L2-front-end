const FLOW_URL = "https://sltrnddigitallab.app.n8n.cloud/webhook/4ace0a3e-a2e3-4e84-b5a7-da84749f9755";

const submitBtn = document.getElementById("submitBtn");
const ticketIdInput = document.getElementById("ticket_id");
const descriptionInput = document.getElementById("description");
const responseContent = document.getElementById("responseContent");
const metaText = document.getElementById("meta");
const errorText = document.getElementById("error");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function formatFriendly(text) {
  const clean = String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  if (!clean) {
    return "<p>No response received.</p>";
  }

  const lines = clean
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const stepLines = lines.filter(line => /^\d+[\.\)]\s*/.test(line));
  const bulletLines = lines.filter(line => /^[-*]\s+/.test(line));

  if (stepLines.length >= 2) {
    const introLines = [];
    const items = [];

    for (const line of lines) {
      if (/^\d+[\.\)]\s*/.test(line)) {
        items.push(line.replace(/^\d+[\.\)]\s*/, ""));
      } else if (!/^[-*]\s+/.test(line)) {
        introLines.push(line);
      }
    }

    const introHtml = introLines.length
      ? `<p>${escapeHtml(introLines.join(" "))}</p>`
      : "";

    const listHtml = `<ol>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;

    return introHtml + listHtml;
  }

  if (bulletLines.length >= 2) {
    const introLines = [];
    const items = [];

    for (const line of lines) {
      if (/^[-*]\s+/.test(line)) {
        items.push(line.replace(/^[-*]\s+/, ""));
      } else {
        introLines.push(line);
      }
    }

    const introHtml = introLines.length
      ? `<p>${escapeHtml(introLines.join(" "))}</p>`
      : "";

    const listHtml = `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

    return introHtml + listHtml;
  }

  return lines.map(line => `<p>${escapeHtml(line)}</p>`).join("");
}

function extractBestText(data) {
  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data) && data.length > 0) {
    return extractBestText(data[0]);
  }

  if (data && typeof data === "object") {
    return (
      data.formatted_answer ||
      data.display_text ||
      data.answer ||
      data.response ||
      data.message ||
      data.description ||
      JSON.stringify(data, null, 2)
    );
  }

  return "No response received.";
}

submitBtn.addEventListener("click", async () => {
  const ticket_id = ticketIdInput.value.trim();
  const description = descriptionInput.value.trim();

  errorText.textContent = "";
  metaText.textContent = "";
  responseContent.innerHTML = "The response will appear here.";

  if (!ticket_id || !description) {
    errorText.textContent = "Please enter both Ticket ID and Description.";
    return;
  }

  try {
    submitBtn.disabled = true;
    metaText.textContent = "Submitting...";

    const res = await fetch(FLOW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ticket_id,
        description
      })
    });

    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Request failed (HTTP ${res.status})`);
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    const finalText = extractBestText(data);
    responseContent.innerHTML = formatFriendly(finalText);
    metaText.textContent = "Submitted successfully.";
  } catch (error) {
    errorText.textContent = "Request failed. Please try again.";
    metaText.textContent = "";
    console.error(error);
  } finally {
    submitBtn.disabled = false;
  }
});