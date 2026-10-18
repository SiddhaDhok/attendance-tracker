// ==========================================================
// calendar.js — the calendar screen for one subject
//
//  - draws the month grid, coloured by each date's state
//  - shows the summary box (percentage, attended, absent, can miss)
//  - tapping a date opens a sheet: add class / absent / present /
//    cancelled / remove
//  - "Quick-fill" adds many class days at once (weekdays + date range)
//
// app.js passes in two functions when it calls initCalendar():
//   onBack()          - back arrow tapped
//   onEdit(subjectId) - pencil icon tapped
// ==========================================================

import { getSubject, addClasses, setClassStatus, removeClass } from "./storage.js";
import { calculate, getDayState } from "./calc.js";
import {
  todayKey, parseDateKey, toDateKey, daysInMonth, mondayIndex,
  monthLabel, formatLong, eachDateBetween, addDays, showToast, round1
} from "./utils.js";

// ---------- page elements ----------
const nameEl = document.getElementById("calendar-subject-name");
const requiredEl = document.getElementById("calendar-required");
const editBtn = document.getElementById("btn-edit-subject");
const backBtn = document.getElementById("btn-calendar-back");
const summaryEl = document.getElementById("calendar-summary");
const monthLabelEl = document.getElementById("month-label");
const prevBtn = document.getElementById("btn-prev-month");
const nextBtn = document.getElementById("btn-next-month");
const gridEl = document.getElementById("calendar-grid");
const quickFillBtn = document.getElementById("btn-quick-fill");

const daySheet = document.getElementById("day-sheet");
const daySheetTitle = document.getElementById("day-sheet-title");
const daySheetStatus = document.getElementById("day-sheet-status");
const daySheetActions = document.getElementById("day-sheet-actions");
const dayCloseBtn = document.getElementById("btn-day-close");

const fillSheet = document.getElementById("fill-sheet");
const fillForm = document.getElementById("fill-form");
const fillStart = document.getElementById("fill-start");
const fillEnd = document.getElementById("fill-end");
const fillCancelBtn = document.getElementById("btn-fill-cancel");

// ---------- state ----------
let callbacks = { onBack() {}, onEdit() {} };
let currentId = null;   // subject being shown
let viewYear = 0;       // month being shown
let viewMonth = 0;      // 0 = January ... 11 = December
let sheetDate = null;   // date key the day sheet is open for

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- setup (called once by app.js) ----------
export function initCalendar(cb) {
  callbacks = { ...callbacks, ...cb };

  backBtn.addEventListener("click", () => callbacks.onBack());
  editBtn.addEventListener("click", () => callbacks.onEdit(currentId));
  prevBtn.addEventListener("click", () => changeMonth(-1));
  nextBtn.addEventListener("click", () => changeMonth(1));

  // One listener for all date buttons
  gridEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button.day");
    if (btn) openDaySheet(btn.dataset.date);
  });

  // Day sheet
  daySheetActions.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action]");
    if (btn) applyAction(btn.dataset.action);
  });
  dayCloseBtn.addEventListener("click", closeDaySheet);
  daySheet.addEventListener("click", (event) => {
    if (event.target === daySheet) closeDaySheet(); // tap outside the sheet
  });

  // Quick-fill sheet
  quickFillBtn.addEventListener("click", openFillSheet);
  fillCancelBtn.addEventListener("click", closeFillSheet);
  fillSheet.addEventListener("click", (event) => {
    if (event.target === fillSheet) closeFillSheet();
  });
  fillForm.addEventListener("submit", handleFill);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDaySheet();
      closeFillSheet();
    }
  });
}

// Shows a subject's calendar, starting at the current month.
// app.js shows the screen after calling this.
export function openCalendar(subjectId) {
  currentId = subjectId;
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  closeDaySheet();
  closeFillSheet();
  render();
}

// ---------- drawing ----------
function render() {
  const subject = getSubject(currentId);
  if (!subject) {
    callbacks.onBack();
    return;
  }

  const today = todayKey();

  nameEl.textContent = subject.name;
  requiredEl.textContent = `Required ${subject.required}%`;
  monthLabelEl.textContent = monthLabel(viewYear, viewMonth);

  renderSummary(subject, today);
  renderGrid(subject, today);
}

function renderSummary(subject, today) {
  const r = calculate(subject, today);

  const stats = el("div", "summary-stats");
  const items = [
    [r.percentage === null ? "–" : `${round1(r.percentage)}%`, "Attendance"],
    [`${r.attended}/${r.held}`, "Attended"],
    [String(r.absent), "Absent"],
    [String(r.canMiss), "Can miss"]
  ];
  for (const [value, label] of items) {
    const stat = el("div", "stat");
    stat.appendChild(el("span", "stat-value", value));
    stat.appendChild(el("span", "stat-label", label));
    stats.appendChild(stat);
  }

  const message = el("p", `summary-message status-${r.status}`, r.message);
  summaryEl.replaceChildren(stats, message);
}

const STATE_LABELS = {
  none: "no class",
  present: "present",
  absent: "absent",
  cancelled: "cancelled",
  upcoming: "upcoming class"
};

function renderGrid(subject, today) {
  gridEl.replaceChildren();

  // Empty cells before the 1st so it lands under the right weekday (Monday first)
  const blanks = mondayIndex(new Date(viewYear, viewMonth, 1));
  for (let i = 0; i < blanks; i++) {
    gridEl.appendChild(el("span", "day day-empty"));
  }

  const count = daysInMonth(viewYear, viewMonth);
  for (let d = 1; d <= count; d++) {
    const key = toDateKey(new Date(viewYear, viewMonth, d));
    const state = getDayState(subject, key, today);

    const btn = el("button", `day day-${state}`, String(d));
    btn.type = "button";
    btn.dataset.date = key;
    btn.setAttribute("aria-label", `${formatLong(key)}, ${STATE_LABELS[state]}`);
    if (key === today) btn.classList.add("is-today");
    gridEl.appendChild(btn);
  }
}

function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear--;
  } else if (viewMonth > 11) {
    viewMonth = 0;
    viewYear++;
  }
  render();
}

// ---------- day sheet: actions for one date ----------
function openDaySheet(dateKey) {
  const subject = getSubject(currentId);
  if (!subject) return;

  sheetDate = dateKey;
  const today = todayKey();
  const state = getDayState(subject, dateKey, today);

  daySheetTitle.textContent = formatLong(dateKey);

  const statusText = {
    none: "No class on this day.",
    present: "Present (counted automatically).",
    upcoming: "Upcoming class.",
    absent: dateKey > today ? "Planned absence." : "Absent.",
    cancelled: "Cancelled. Not counted in your total."
  };
  daySheetStatus.textContent = statusText[state];

  // Build the buttons that make sense for this state
  const buttons = [];
  if (state === "none") {
    buttons.push(["add", "Add a class on this day", "btn-secondary"]);
  }
  if (state === "present" || state === "upcoming") {
    buttons.push(["absent", dateKey > today ? "Mark planned absence" : "Mark absent", "btn-danger"]);
    buttons.push(["cancelled", "Mark class cancelled", "btn-warn"]);
  }
  if (state === "absent") {
    buttons.push(["present", "Mark present", "btn-ok"]);
    buttons.push(["cancelled", "Mark class cancelled", "btn-warn"]);
  }
  if (state === "cancelled") {
    buttons.push(["present", "Restore class", "btn-ok"]);
  }
  if (state !== "none") {
    buttons.push(["remove", "Remove this class day", "btn-ghost"]);
  }

  daySheetActions.replaceChildren();
  for (const [action, label, style] of buttons) {
    const btn = el("button", `btn btn-block ${style}`, label);
    btn.type = "button";
    btn.dataset.action = action;
    daySheetActions.appendChild(btn);
  }

  daySheet.hidden = false;
}

function closeDaySheet() {
  daySheet.hidden = true;
  sheetDate = null;
}

function applyAction(action) {
  if (!sheetDate || !currentId) return;

  const messages = {
    add: "Class added.",
    absent: "Marked absent.",
    present: "Marked present.",
    cancelled: "Marked cancelled.",
    remove: "Class day removed."
  };

  if (action === "add" || action === "present") {
    setClassStatus(currentId, sheetDate, "present");
  } else if (action === "absent") {
    setClassStatus(currentId, sheetDate, "absent");
  } else if (action === "cancelled") {
    setClassStatus(currentId, sheetDate, "cancelled");
  } else if (action === "remove") {
    removeClass(currentId, sheetDate);
  }

  showToast(messages[action]);
  closeDaySheet();
  render();
}

// ---------- quick-fill sheet ----------
function openFillSheet() {
  for (const box of fillForm.querySelectorAll('input[name="weekday"]')) {
    box.checked = false;
  }
  const today = todayKey();
  fillStart.value = today;
  fillEnd.value = addDays(today, 120); // about one semester; edit as needed
  fillSheet.hidden = false;
}

function closeFillSheet() {
  fillSheet.hidden = true;
}

function handleFill(event) {
  event.preventDefault();

  const weekdays = [...fillForm.querySelectorAll('input[name="weekday"]:checked')].map((b) =>
    Number(b.value)
  );
  if (weekdays.length === 0) {
    showToast("Pick at least one weekday.");
    return;
  }

  const start = fillStart.value;
  const end = fillEnd.value;
  if (!start || !end) {
    showToast("Pick a start and an end date.");
    return;
  }
  if (end < start) {
    showToast("The end date must be after the start date.");
    return;
  }

  const range = eachDateBetween(start, end, 801);
  if (range.length > 800) {
    showToast("That range is too long. Use 800 days or fewer.");
    return;
  }

  const matching = range.filter((key) => weekdays.includes(parseDateKey(key).getDay()));
  const added = addClasses(currentId, matching);

  closeFillSheet();

  // Jump to the first month that received classes so you can see them
  const first = parseDateKey(start);
  viewYear = first.getFullYear();
  viewMonth = first.getMonth();
  render();

  showToast(
    added > 0
      ? `Added ${added} class ${added === 1 ? "day" : "days"}.`
      : "No new class days. Those dates were already added."
  );
}