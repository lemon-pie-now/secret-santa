// ----------------------
// CONFIG
// ----------------------
// 🔧 Set this to your deployed backend URL (Render/Railway/etc.), NOT localhost.
// Example: "https://secret-santa-api-xyz.onrender.com"
const API_BASE = "https://YOUR-RENDER-API.onrender.com";

// ----------------------
// DOM
// ----------------------
const participantsInput = document.getElementById("participantsInput");
const generateBtn = document.getElementById("generateBtn");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");

const generatorView = document.getElementById("generatorView");
const assignmentView = document.getElementById("assignmentView");
const assignmentText = document.getElementById("assignmentText");
const assignmentMeta = document.getElementById("assignmentMeta");

const wishlistForm = document.getElementById("wishlistForm");
const wishlistInputs = document.querySelectorAll(".wishlist-input");
const wishlistSaveMsg = document.getElementById("wishlistSaveMsg");
const recipientWishlistEl = document.getElementById("recipientWishlist");

// Current participant context (when opening a secret link)
let currentEventId = null;
let currentKey = null;
let currentGiver = null;
let currentRecipient = null;

// ----------------------
// INIT
// ----------------------
document.addEventListener("DOMContentLoaded", async () => {
  const eventId = getQueryParam("event");
  const key = getQueryParam("key");

  // Participant mode: index.html?event=EVENT_ID&key=PAIR_KEY
  if (eventId && key) {
    currentEventId = eventId;
    currentKey = key;

    generatorView.classList.add("hidden");
    assignmentView.classList.remove("hidden");

    assignmentText.textContent = "Loading your assignment...";
    assignmentMeta.textContent = "";

    try {
      const pair = await fetchPair(currentEventId, currentKey);
      currentGiver = pair.giver;
      currentRecipient = pair.recipient;

      assignmentText.textContent = `${currentGiver}, you are gifting to: ${currentRecipient}.`;
      assignmentMeta.textContent =
        "Below you can see your recipient’s wishlist and add your own wishlist (so your Secret Santa knows what to get you).";

      await initWishlistUI();
    } catch (err) {
      console.error(err);
      assignmentText.textContent = "Could not load your assignment.";
      assignmentMeta.textContent = "Check your link or try again later.";
    }

    return;
  }

  // Organizer mode
  generatorView.classList.remove("hidden");
  assignmentView.classList.add("hidden");
});

// ----------------------
// ORGANIZER: Generate Event
// ----------------------
if (generateBtn) {
  generateBtn.addEventListener("click", async () => {
    errorEl.textContent = "";
    resultsEl.innerHTML = "";

    let names;
    try {
      names = parseNames(participantsInput.value);
    } catch (err) {
      errorEl.textContent = err.message;
      return;
    }

    const pairs = generateSecretSantaPairs(names);
    if (!pairs) {
      errorEl.textContent = "Could not generate pairs. Try again.";
      return;
    }

    // Create a unique eventId for this run
    const eventId = generateId(10);

    // Save each pair to backend with a unique key
    try {
      for (const p of pairs) {
        const key = generateId(12);
        await savePair(eventId, key, p.from, p.to);
        p.key = key;
      }

      renderOrganizerOutput(eventId, pairs);
    } catch (err) {
      console.error(err);
      errorEl.textContent =
        "Failed to save pairs to backend. Check your API_BASE and backend status, then try again.";
    }
  });
}

function renderOrganizerOutput(eventId, pairsWithKeys) {
  resultsEl.innerHTML = "";

  const basePath =
    window.location.origin +
    window.location.pathname.replace(/index\.html?$/i, "");

  const resultsUrl = `${basePath}results.html?event=${encodeURIComponent(eventId)}`;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML =
    `<p class="hint"><strong>Share this Results link:</strong><br>` +
    `<a href="${resultsUrl}" target="_blank">${resultsUrl}</a></p>` +
    `<p class="hint">Participants should open the Results link, find their name, and use their Secret Link.</p>`;
  resultsEl.appendChild(card);

  // Show individual links too (optional but useful)
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Giver", "Secret Link"].forEach((t) => {
    const th = document.createElement("th");
    th.textContent = t;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  pairsWithKeys
    .slice()
    .sort((a, b) => (a.from || "").localeCompare(b.from || ""))
    .forEach((p) => {
      const linkUrl =
        `${basePath}?event=${encodeURIComponent(eventId)}&key=${encodeURIComponent(p.key)}`;

      const tr = document.createElement("tr");

      const giverTd = document.createElement("td");
      giverTd.textContent = p.from;
      tr.appendChild(giverTd);

      const linkTd = document.createElement("td");
      const a = document.createElement("a");
      a.href = linkUrl;
      a.textContent = linkUrl;
      a.target = "_blank";
      linkTd.appendChild(a);
      tr.appendChild(linkTd);

      tbody.appendChild(tr);
    });

  table.appendChild(tbody);
  resultsEl.appendChild(table);
}

// ----------------------
// PARTICIPANT: Wishlists
// ----------------------
async function initWishlistUI() {
  if (!wishlistForm || !currentEventId || !currentGiver || !currentRecipient) return;

  // Prefill giver's own wishlist inputs
  const myWishlist = await loadWishlist(currentEventId, currentGiver);
  for (let i = 0; i < wishlistInputs.length; i++) {
    wishlistInputs[i].value = myWishlist[i] || "";
  }

  // Show recipient wishlist
  const recipWishlist = await loadWishlist(currentEventId, currentRecipient);
  renderRecipientWishlist(recipWishlist);
}

if (wishlistForm) {
  wishlistForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    wishlistSaveMsg.textContent = "";

    if (!currentEventId || !currentGiver) return;

    const items = [];
    wishlistInputs.forEach((input) => {
      const v = input.value.trim();
      if (v) items.push(v);
    });

    // Hard cap at 5 on client too
    const cleaned = items.slice(0, 5);

    try {
      await saveWishlist(currentEventId, currentGiver, cleaned);
      wishlistSaveMsg.textContent = "Saved!";
    } catch (err) {
      console.error(err);
      wishlistSaveMsg.textContent = "Could not save. Please try again.";
    }
  });
}

function renderRecipientWishlist(items) {
  recipientWishlistEl.innerHTML = "";

  if (!items || items.length === 0) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Your recipient has not added a wishlist yet.";
    recipientWishlistEl.appendChild(p);
    return;
  }

  const ul = document.createElement("ul");
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  });
  recipientWishlistEl.appendChild(ul);
}

// ----------------------
// API Calls
// ----------------------
async function savePair(eventId, key, giver, recipient) {
  const res = await fetch(`${API_BASE}/api/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, key, giver, recipient })
  });
  if (!res.ok) throw new Error("Failed to save pair");
}

async function fetchPair(eventId, key) {
  const res = await fetch(
    `${API_BASE}/api/pair/${encodeURIComponent(eventId)}/${encodeURIComponent(key)}`
  );
  if (!res.ok) throw new Error("Failed to fetch pair");
  return await res.json();
}

async function loadWishlist(eventId, name) {
  const res = await fetch(
    `${API_BASE}/api/wishlist/${encodeURIComponent(eventId)}/${encodeURIComponent(name)}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

async function saveWishlist(eventId, name, items) {
  const res = await fetch(`${API_BASE}/api/wishlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, name, items })
  });
  if (!res.ok) throw new Error("Failed to save wishlist");
}

// ----------------------
// Core logic: parse + generate pairs
// ----------------------
function parseNames(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("Please enter at least 2 participants.");
  }

  const lower = lines.map((n) => n.toLowerCase());
  const unique = new Set(lower);
  if (unique.size !== lower.length) {
    throw new Error("Duplicate names detected. Names must be unique.");
  }

  return lines;
}

function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateSecretSantaPairs(names) {
  const maxAttempts = 200;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const receivers = shuffle(names);

    let valid = true;
    for (let i = 0; i < names.length; i++) {
      if (names[i] === receivers[i]) {
        valid = false;
        break;
      }
    }

    if (valid) {
      return names.map((giver, i) => ({ from: giver, to: receivers[i] }));
    }
  }

  return null;
}

// ----------------------
// Utils
// ----------------------
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Random-ish id for event + key (fine for learning; not cryptographic)
function generateId(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}