// ==========================================================
// dashboard.js — the home screen: one card per subject
//
// Each card shows the attendance percentage, a progress bar with a
// line at the required percentage, the counts, and one message
// (how many classes you can still miss, or a warning).
// Tapping a card opens that subject's calendar.
// ==========================================================

import { getSubjects } from "./storage.js";
import { calculate } from "./calc.js";
import { todayKey, formatLong, round1 } from "./utils.js";

const listEl = document.getElementById("subject-list");
const emptyEl = document.getElementById("empty-state");
const todayEl = document.getElementById("today-label");

// Small helper: create an element with a class and text.
// Using textContent (not innerHTML) means a subject name can never inject HTML.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Called once by app.js. onOpen(subjectId) runs when a card is tapped.
export function initDashboard(onOpen) {
  listEl.addEventListener("click", (event) => {
    const card = event.target.closest(".subject-card");
    if (card) onOpen(card.dataset.id);
  });
}

// Redraws the whole dashboard from the saved data.
// Called every time the dashboard is shown, so the numbers are always current.
export function renderDashboard() {
  const today = todayKey();
  todayEl.textContent = formatLong(today);

  const subjects = getSubjects();
  listEl.replaceChildren();
  emptyEl.hidden = subjects.length > 0;

  for (const subject of subjects) {
    listEl.appendChild(buildCard(subject, today));
  }
}

function buildCard(subject, today) {
  const r = calculate(subject, today);

  const card = el("button", `subject-card status-${r.status}`);
  card.type = "button";
  card.dataset.id = subject.id;

  // Top row: subject name and percentage
  const head = el("div", "card-head");
  head.appendChild(el("h3", "card-title", subject.name));
  head.appendChild(
    el("span", "card-percent", r.percentage === null ? "–" : `${round1(r.percentage)}%`)
  );
  card.appendChild(head);

  // Progress bar. The thin marker sits at the required percentage.
  const bar = el("div", "progress");
  const fill = el("div", "progress-fill");
  fill.style.width = `${Math.min(100, r.percentage ?? 0)}%`;
  const marker = el("div", "progress-marker");
  marker.style.left = `${Math.min(100, r.required)}%`;
  bar.appendChild(fill);
  bar.appendChild(marker);
  card.appendChild(bar);

  // Counts line
  const parts = [`Attended ${r.attended} of ${r.held}`, `Required ${r.required}%`];
  if (r.upcoming > 0) parts.push(`${r.upcoming} upcoming`);
  if (r.cancelled > 0) parts.push(`${r.cancelled} cancelled`);
  card.appendChild(el("p", "card-meta", parts.join(" · ")));

  // Main message
  card.appendChild(el("p", "card-message", r.message));

  return card;
}