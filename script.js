// The board is drawn from this list. Each lane is one subreddit.
let lanes = [];

// Only one lane menu is open at a time. Null means they are all closed.
let openMenuName = null;

const STORAGE_KEY = "reddit-lanes";
const STARTER_LANES = ["learnprogramming", "javascript"];
const POST_LIMIT = 10;

const board = document.querySelector(".board");
const addColumn = document.querySelector(".add-column");
const addButton = document.querySelector("#add-button");
const popupBackdrop = document.querySelector("#popup-backdrop");
const subredditForm = document.querySelector("#subreddit-form");
const subredditInput = document.querySelector("#subreddit-input");
const popupError = document.querySelector("#popup-error");

// Saved data is only the names. Posts are loaded again on each visit.
function loadLanes() {
  const saved = readSavedNames();

  const names = saved === null ? STARTER_LANES : saved;
  lanes = names.map((name) => ({
    name,
    posts: [],
    status: "loading",
    errorMessage: ""
  }));
}

function readSavedNames() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) {
      return null;
    }

    return saved.filter((name) => typeof name === "string" && isValidName(name));
  } catch (error) {
    return null;
  }
}

function saveLanes() {
  const names = lanes.map((lane) => lane.name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
}

// Accepts "javascript", "r/javascript", or "/r/javascript".
function normalizeName(input) {
  const name = input.trim().replace(/^\/?r\//i, "");

  if (!name) {
    return { name: "", error: "Enter a subreddit name." };
  }

  if (!isValidName(name)) {
    return { name: "", error: "Use letters, numbers, or underscores only." };
  }

  const alreadyAdded = lanes.some(
    (lane) => lane.name.toLowerCase() === name.toLowerCase()
  );
  if (alreadyAdded) {
    return { name: "", error: "That subreddit is already on the board." };
  }

  return { name, error: "" };
}

function isValidName(name) {
  return /^[A-Za-z0-9_]{2,21}$/.test(name);
}

// Ask Reddit for its public JSON feed first. Browsers are often blocked
// from reading that response, so the same post fields are then read from
// a public archive that allows browser requests.
async function fetchSubreddit(name) {
  const redditUrl =
    `https://www.reddit.com/r/${encodeURIComponent(name)}.json?raw_json=1&limit=${POST_LIMIT}`;

  try {
    return await readRedditListing(redditUrl);
  } catch (error) {
    return readArchive(name);
  }
}

async function readRedditListing(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load this subreddit.");
  }

  const payload = await response.json();
  const children = payload?.data?.children;
  if (!Array.isArray(children)) {
    throw new Error("Could not load this subreddit.");
  }

  return toPosts(children.map((child) => child.data || {}));
}

async function readArchive(name) {
  const url =
    `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(name)}&limit=${POST_LIMIT}&sort=desc`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load this subreddit.");
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.data)) {
    throw new Error("Could not load this subreddit.");
  }

  return toPosts(payload.data);
}

function toPosts(items) {
  const posts = items.slice(0, POST_LIMIT).map((data) => ({
    title: data.title || "Untitled post",
    score: data.ups ?? data.score ?? 0,
    url: postUrl(data.permalink)
  }));

  if (posts.length === 0) {
    throw new Error("Could not load this subreddit.");
  }

  return posts;
}

function postUrl(permalink) {
  if (!permalink) {
    return "https://www.reddit.com";
  }
  if (permalink.startsWith("http")) {
    return permalink;
  }
  return `https://www.reddit.com${permalink}`;
}

function addLane(input) {
  const result = normalizeName(input);
  if (result.error) {
    showPopupError(result.error);
    return;
  }

  lanes.push({
    name: result.name,
    posts: [],
    status: "loading",
    errorMessage: ""
  });
  saveLanes();
  closePopup();
  render();
  loadLane(result.name);
}

function refreshLane(name) {
  loadLane(name);
}

function deleteLane(name) {
  lanes = lanes.filter((lane) => lane.name !== name);
  saveLanes();
  render();
}

// One lane can fail or reload without changing the other lanes.
async function loadLane(name) {
  const lane = lanes.find((item) => item.name === name);
  if (!lane) {
    return;
  }

  lane.status = "loading";
  lane.errorMessage = "";
  render();

  try {
    lane.posts = await fetchSubreddit(name);
    lane.status = "ready";
  } catch (error) {
    lane.posts = [];
    lane.status = "error";
    lane.errorMessage = `Could not load r/${name}.`;
  }

  // The lane may have been deleted while the request was still running.
  if (lanes.includes(lane)) {
    render();
  }
}

function render() {
  board.querySelectorAll(".lane").forEach((lane) => lane.remove());

  lanes.forEach((lane) => {
    addColumn.before(renderLane(lane));
  });
}

function renderLane(lane) {
  const section = document.createElement("section");
  section.className = "lane";
  section.setAttribute("aria-label", `r/${lane.name}`);

  const header = document.createElement("header");
  header.className = "lane-header";

  const title = document.createElement("h2");
  title.className = "lane-title";
  title.textContent = `/r/${lane.name}`;

  const menu = document.createElement("div");
  menu.className = "menu";

  const menuButton = document.createElement("button");
  menuButton.className = "menu-button";
  menuButton.type = "button";
  menuButton.setAttribute("aria-label", `Options for r/${lane.name}`);
  menuButton.textContent = "⋮";
  menuButton.addEventListener("click", () => openMenu(lane.name));

  const panel = document.createElement("div");
  panel.className = "menu-panel";
  panel.hidden = openMenuName !== lane.name;

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "Refresh";
  refreshButton.addEventListener("click", () => {
    closeMenus();
    refreshLane(lane.name);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => {
    closeMenus();
    deleteLane(lane.name);
  });

  panel.append(refreshButton, deleteButton);
  menu.append(menuButton, panel);
  header.append(title, menu);

  const posts = document.createElement("div");
  posts.className = "posts";

  if (lane.status === "loading") {
    posts.append(statusRow("Loading…"));
  } else if (lane.status === "error") {
    posts.append(statusRow(lane.errorMessage, true));
  } else if (lane.posts.length === 0) {
    posts.append(statusRow("No posts right now."));
  } else {
    lane.posts.forEach((post) => posts.append(renderPost(post)));
  }

  section.append(header, posts);
  return section;
}

function renderPost(post) {
  const link = document.createElement("a");
  link.className = "post";
  link.href = post.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const vote = document.createElement("span");
  vote.className = "vote";

  const caret = document.createElement("span");
  caret.className = "caret";
  caret.setAttribute("aria-hidden", "true");
  caret.textContent = "▲";

  const score = document.createElement("span");
  score.className = "score";
  score.textContent = String(post.score);

  const title = document.createElement("span");
  title.className = "post-title";
  title.textContent = post.title;

  vote.append(caret, score);
  link.append(vote, title);
  return link;
}

function statusRow(message, isError) {
  const row = document.createElement("p");
  row.className = isError ? "lane-status error" : "lane-status";
  row.textContent = message;
  return row;
}

function openMenu(name) {
  openMenuName = openMenuName === name ? null : name;
  render();
}

function closeMenus() {
  if (!openMenuName) {
    return;
  }

  openMenuName = null;
  document.querySelectorAll(".menu-panel").forEach((panel) => {
    panel.hidden = true;
  });
}

function openPopup() {
  popupError.hidden = true;
  popupError.textContent = "";
  subredditInput.value = "";
  popupBackdrop.hidden = false;
  subredditInput.focus();
}

function closePopup() {
  popupBackdrop.hidden = true;
}

function showPopupError(message) {
  popupError.textContent = message;
  popupError.hidden = false;
}

addButton.addEventListener("click", openPopup);

subredditForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addLane(subredditInput.value);
});

popupBackdrop.addEventListener("click", (event) => {
  if (event.target === popupBackdrop) {
    closePopup();
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".menu")) {
    return;
  }
  closeMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  closePopup();
  closeMenus();
});

loadLanes();
render();
lanes.forEach((lane) => loadLane(lane.name));
