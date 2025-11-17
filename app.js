// Get DOM elements
const namesInput = document.getElementById("namesInput");
const generateBtn = document.getElementById("generateBtn");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");

// Attach click handler
generateBtn.addEventListener("click", () => {
  errorEl.textContent = "";
  resultsEl.innerHTML = "";

  const names = parseNames(namesInput.value);

  if (names.length < 2) {
    errorEl.textContent = "Please enter at least 2 names.";
    return;
  }

  const pairs = generateSecretSantaPairs(names);

  if (!pairs) {
    errorEl.textContent = "Could not generate pairs. Try a different list.";
    return;
  }

  renderResults(pairs);
});

// Split text into cleaned array of names
function parseNames(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Fisher–Yates shuffle
function shuffle(array) {
  const arr = array.slice(); // copy
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate Secret Santa assignments with no self-pair
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

  // If we somehow fail after many attempts
  return null;
}

// Show results in the DOM
function renderResults(pairs) {
  const ul = document.createElement("ul");

  pairs.forEach((pair) => {
    const li = document.createElement("li");
    li.textContent = `${pair.from} → ${pair.to}`;
    ul.appendChild(li);
  });

  resultsEl.appendChild(ul);
}