// ==========================================================
// utils.js — date helpers and small shared functions
//
// Every date in this app is stored as a text key: "YYYY-MM-DD"
// Example: "2026-10-18". These keys sort correctly as plain text,
// so "2026-10-18" < "2026-11-02" works without converting anything.
// ==========================================================

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n) {
  return String(n).padStart(2, "0");
}

// Date object -> "YYYY-MM-DD" using the LOCAL date on the device.
// (We do not use date.toISOString() on purpose: it converts to UTC first.
//  In India, at 00:30 on 19 Oct, UTC time is 19:00 on 18 Oct, so
//  toISOString() would return "2026-10-18", the wrong day.)
export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "YYYY-MM-DD" -> Date object at local midnight
export function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toDateKey(new Date());
}

// Add (or subtract) days to a date key and return a new key
export function addDays(key, n) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + n);
  return toDateKey(date);
}

// All date keys from startKey to endKey, both included.
// Capped at 800 days so a typing mistake (like year 2062) cannot freeze the page.
export function eachDateBetween(startKey, endKey, maxDays = 800) {
  const keys = [];
  if (startKey > endKey) return keys;

  let current = startKey;
  while (current <= endKey && keys.length < maxDays) {
    keys.push(current);
    current = addDays(current, 1);
  }
  return keys;
}

// Number of days in a month. month is 0-11 (JavaScript style: 0 = January)
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Weekday position in a week that starts on Monday: Mon = 0 ... Sun = 6
// (JavaScript's getDay() gives Sun = 0, Mon = 1 ... Sat = 6)
export function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

// "October 2026"
export function monthLabel(year, month) {
  return `${MONTH_NAMES[month]} ${year}`;
}

// "Sun, 18 Oct 2026"
export function formatLong(key) {
  const d = parseDateKey(key);
  return `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// "18 Oct"
export function formatShort(key) {
  const d = parseDateKey(key);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

// Unique id for each subject, e.g. "s_lq3k9x_4f2a"
export function makeId() {
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

// Show a small message at the bottom of the screen for 2.5 seconds
let toastTimer = null;
export function showToast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2500);
}

// Round to 1 decimal place: 86.666 -> 86.7
export function round1(n) {
  return Math.round(n * 10) / 10;
}