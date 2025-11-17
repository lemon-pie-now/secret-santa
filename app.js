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
// ===== Render results (just a list of links, no emails) =====
// ===== Render results + create shareable results page URL =====
function renderResults(pairs, participants) {
  // Clear previous results
  resultsEl.innerHTML = "";

  // Build the data we want to share (just names)
  const pairsForSharing = pairs.map((p) => ({
    from: p.from,
    to: p.to,
  }));

  // Encode as base64 so it fits in a URL
  const encoded = encodeBase64(JSON.stringify(pairsForSharing));

  // Build URL to results.html in the same folder
  const basePath =
    window.location.origin +
    window.location.pathname.replace(/index\.html?$/i, "");
  const shareUrl = `${basePath}results.html?data=${encoded}`;

  // Show the share URL
  const shareP = document.createElement("p");
  shareP.innerHTML =
    `Share this page with your participants: <br>` +
    `<a href="${shareUrl}" target="_blank">${shareUrl}</a>`;
  resultsEl.appendChild(shareP);

  // Also show local table of links (for the organizer)
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  ["Giver", "Secret Link"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  const assignmentBase =
    window.location.origin +
    window.location.pathname.replace(/index\.html?$/i, "");

  for (const pair of pairs) {
    const giverName = pair.from;
    const recipientName = pair.to;

    const linkUrl =
      `${assignmentBase}?giver=` +
      encodeURIComponent(giverName) +
      `&recipient=` +
      encodeURIComponent(recipientName);

    const tr = document.createElement("tr");

    const giverTd = document.createElement("td");
    giverTd.textContent = giverName;
    tr.appendChild(giverTd);

    const linkTd = document.createElement("td");
    const linkA = document.createElement("a");
    linkA.href = linkUrl;
    linkA.textContent = linkUrl;
    linkA.target = "_blank";
    linkTd.appendChild(linkA);
    tr.appendChild(linkTd);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  resultsEl.appendChild(table);
}

// ===== Helpers for base64 with UTF-8 support =====
function encodeBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64(str) {
  return decodeURIComponent(escape(atob(str)));
}
// ===== Helper: get query param =====
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}