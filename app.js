// ----------------------
// CONFIG
// ----------------------
// Put your deployed backend URL here (Render/Railway/etc), NOT localhost.
const API_BASE = "https://secret-santa-api-ijd1.onrender.com/";

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

  // Participant link mode: index.html?event=EVENT_ID&key=PAIR_KEY
  if (eventId && key) {
    currentEventId = eventId;
    currentKey = key;

    generatorView.classList.add("hidden");
    assignmentView.classList.remove("hidden");

    try {
      const pair = await fetchPair(currentEventId, currentKey);
      currentGiver = pair.giver;
      currentRecipient = pair.recipient;

      assignmentText.textContent =
        `${currentGiver}, you are gifting to: ${currentRecipient}.`;

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

    if (names.length < 2) {
      errorEl.textContent = "Please enter at least 2 participants.";
      return;
    }

    const pairs = generateSecretSantaPairs(names);
    if (!pairs) {
      errorEl.textContent = "Could not generate pairs. Try again.";
      return;
    }

    // Create a new eventId for this run
    const eventId = generateId(10);

    try {
      // Save each pair to backend under this event
      for (const p of pairs) {
        const key = generateId(12);
        await savePair(eventId, key, p.from, p.to);
        p.key = key; // attach for rendering
      }

      renderOrganizerShare(eventId, pairs);
    } catch (err) {
      console.error(err);
      errorEl.textContent = "Failed to save pairs to backend. Check API_BASE and try again.";
    }
  });
}

function renderOrganizerShare(eventId, pairsWithKeys) {
  resultsEl.innerHTML = "";

  const basePath =
    window.location.origin +
    window.location.pathname.replace(/index\.html?$/i, "");

  const resultsUrl = `${basePath}results.html?event=${encodeURIComponent(eventId)}`;

  const shareP = document.createElement("p");
  shareP.innerHTML =
    `Share this page with participants:<br>` +
    `<a href="${resultsUrl}" target="_blank">${resultsUrl}</a>`;
  resultsEl.appendChild(shareP);

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

  // Sort by giver for nicer display
  pairsWithKeys.sort((a, b) => (a.from || "").localeCompare(b.from || ""));

  for (const p of pairsWithKeys) {
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
  }

  table.appendChild(tbody);
  resultsEl.appendChild(table);
}

// ----------------------
// PARTICIPANT: Wishlists
// ----------------------
async function initWishlistUI() {
  if (!wishlistForm || !currentEventId || !currentGiver || !currentRecipient) return;

  // Load giver's own wishlist into form
  const myWishlist = await loadWishlist(currentEventId, currentGiver);
  for (let i = 0; i < wishlistInputs.length; i++) {
    wishlistInputs[i].value = myWishlist[i] || "";
  }

  // Load recipient wishlist for display
  const recipWishlist = await loadWishlist(currentEventId, currentRecipient);
  renderWishlistDisplay(recipWishlist);
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

    try {
      await saveWishlist(currentEventId, currentGiver, items);
      wishlistSaveMsg.textContent = "Saved!";
    } catch (err) {
      console.error(err);
      wishlistSaveMsg.textContent = "Could not save. Please try again.";
    }
  });
}

function renderWishlistDisplay(items) {
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
  const maxAttempts = 100;

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

// random-ish id suitable for links (learning app)
function generateId(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}