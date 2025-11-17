// ===== DOM elements =====
const participantsInput = document.getElementById("participantsInput");
const generateBtn = document.getElementById("generateBtn");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");

const generatorView = document.getElementById("generatorView");
const assignmentView = document.getElementById("assignmentView");
const assignmentText = document.getElementById("assignmentText");

// ===== On load: check if this is an assignment link =====
document.addEventListener("DOMContentLoaded", () => {
  const giver = getQueryParam("giver");
  const recipient = getQueryParam("recipient");

  if (giver && recipient) {
    // Show assignment-only view
    generatorView.classList.add("hidden");
    assignmentView.classList.remove("hidden");
    assignmentText.textContent = `${giver}, you are gifting to: ${recipient}.`;
  } else {
    // Normal organizer view
    generatorView.classList.remove("hidden");
    assignmentView.classList.add("hidden");
  }
});

// ===== Event: generate pairs =====
generateBtn.addEventListener("click", () => {
  errorEl.textContent = "";
  resultsEl.innerHTML = "";

  let participants;
  try {
    participants = parseParticipants(participantsInput.value);
  } catch (err) {
    errorEl.textContent = err.message;
    return;
  }

  if (participants.length < 2) {
    errorEl.textContent = "Please enter at least 2 participants.";
    return;
  }

  const names = participants.map((p) => p.name);
  const pairs = generateSecretSantaPairs(names);

  if (!pairs) {
    errorEl.textContent = "Could not generate pairs. Try a different list.";
    return;
  }

  renderResults(pairs, participants);
});

// ===== Parse "Name, Email" per line =====
function parseParticipants(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const participants = [];

  for (const line of lines) {
    const parts = line.split(",");
    if (parts.length < 2) {
      throw new Error(
        `Line "${line}" is invalid. Use "Name, Email" format.`
      );
    }
    const name = parts[0].trim();
    const email = parts.slice(1).join(",").trim(); // handles commas in names if needed

    if (!name || !email) {
      throw new Error(
        `Line "${line}" is invalid. Name or email missing.`
      );
    }

    participants.push({ name, email });
  }

  // Optional: basic duplicate name check
  const names = participants.map((p) => p.name.toLowerCase());
  const uniqueNames = new Set(names);
  if (uniqueNames.size !== names.length) {
    throw new Error("Duplicate participant names detected. Names must be unique.");
  }

  return participants;
}

// ===== Fisher–Yates shuffle =====
function shuffle(array) {
  const arr = array.slice(); // copy
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== Generate Secret Santa pairs (no self-pair) =====
function generateSecretSantaPairs(names) {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const givers = names.slice();
    const receivers = shuffle(names);

    let valid = true;
    for (let i = 0; i < givers.length; i++) {
      if (givers[i] === receivers[i]) {
        valid = false;
        break;
      }
    }

    if (valid) {
      const pairs = [];
      for (let i = 0; i < givers.length; i++) {
        pairs.push({ from: givers[i], to: receivers[i] });
      }
      return pairs;
    }
  }

  return null;
}

// ===== Render results (with mailto links) =====
function renderResults(pairs, participants) {
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Giver", "Recipient (hidden from email)", "Email link"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  const baseUrl = window.location.origin + window.location.pathname;

  for (const pair of pairs) {
    const giverName = pair.from;
    const recipientName = pair.to;

    // Find giver's email
    const giver = participants.find(
      (p) => p.name.toLowerCase() === giverName.toLowerCase()
    );
    const giverEmail = giver ? giver.email : "";

    // Build unique link for this giver
    const linkUrl =
      `${baseUrl}?giver=` +
      encodeURIComponent(giverName) +
      `&recipient=` +
      encodeURIComponent(recipientName);

    // Build mailto link
    const subject = `Your Secret Santa assignment`;
    const body = `Hi ${giverName},

Here is your Secret Santa link. Open it to see who you're gifting to:

${linkUrl}

Happy gifting!`;
    const mailtoHref =
      `mailto:${encodeURIComponent(giverEmail)}` +
      `?subject=` +
      encodeURIComponent(subject) +
      `&body=` +
      encodeURIComponent(body);

    // Build row
    const tr = document.createElement("tr");

    const giverTd = document.createElement("td");
    giverTd.textContent = giverName;
    tr.appendChild(giverTd);

    const recipientTd = document.createElement("td");
    recipientTd.textContent = recipientName;
    tr.appendChild(recipientTd);

    const emailTd = document.createElement("td");
    const emailLink = document.createElement("a");
    emailLink.href = mailtoHref;
    emailLink.textContent = "Open email draft";
    emailTd.appendChild(emailLink);
    tr.appendChild(emailTd);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  resultsEl.appendChild(table);
}

// ===== Helper: get query param =====
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}