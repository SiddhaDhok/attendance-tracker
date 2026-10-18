// ==========================================================
// storage.js — saves and loads all data
//
// Right now everything lives in the browser's localStorage.
// Every other file talks to storage ONLY through the functions
// below, so moving to Firebase later means changing this file only.
//
// Data shape saved in localStorage under the key "attendance-tracker-data":
// {
//   version: 1,
//   subjects: [
//     {
//       id: "s_lq3k9x_4f2a",
//       name: "Data Structures",
//       required: 75,                       // required attendance %
//       classes: {                          // one entry per class day
//         "2026-10-12": "present",          // "present" | "absent" | "cancelled"
//         "2026-10-14": "absent",
//         "2026-10-16": "cancelled"
//       }
//     }
//   ]
// }
// "present" is the default status of a newly added class day.
// ==========================================================

import { makeId } from "./utils.js";

const STORAGE_KEY = "attendance-tracker-data";
const VALID_STATUSES = ["present", "absent", "cancelled"];

let data = load();

// ---------- reading and writing the browser storage ----------

function emptyData() {
  return { version: 1, subjects: [] };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    return cleanData(parsed) || emptyData();
  } catch (err) {
    console.error("Could not read saved data:", err);
    return emptyData();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Could not save data:", err);
    return false;
  }
}

// Checks that a loaded/imported object has the right shape.
// Returns a cleaned copy, or null if the object is unusable.
function cleanData(obj) {
  if (!obj || !Array.isArray(obj.subjects)) return null;

  const subjects = [];
  for (const s of obj.subjects) {
    if (!s || typeof s.name !== "string") continue;

    const required = Number(s.required);
    const classes = {};
    if (s.classes && typeof s.classes === "object") {
      for (const [dateKey, status] of Object.entries(s.classes)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && VALID_STATUSES.includes(status)) {
          classes[dateKey] = status;
        }
      }
    }

    subjects.push({
      id: typeof s.id === "string" && s.id ? s.id : makeId(),
      name: s.name.trim().slice(0, 40) || "Untitled",
      required: required >= 1 && required <= 100 ? required : 75,
      classes
    });
  }
  return { version: 1, subjects };
}

// ---------- subjects ----------

export function getSubjects() {
  return data.subjects;
}

export function getSubject(id) {
  return data.subjects.find((s) => s.id === id) || null;
}

export function addSubject({ name, required }) {
  const subject = {
    id: makeId(),
    name: name.trim(),
    required: Number(required),
    classes: {}
  };
  data.subjects.push(subject);
  save();
  return subject;
}

export function updateSubject(id, { name, required }) {
  const subject = getSubject(id);
  if (!subject) return null;
  subject.name = name.trim();
  subject.required = Number(required);
  save();
  return subject;
}

export function deleteSubject(id) {
  data.subjects = data.subjects.filter((s) => s.id !== id);
  save();
}

// ---------- class days ----------

// Adds many class days at once (used by quick-fill).
// A date that already has a status keeps it. Returns how many were new.
export function addClasses(id, dateKeys) {
  const subject = getSubject(id);
  if (!subject) return 0;

  let added = 0;
  for (const key of dateKeys) {
    if (!subject.classes[key]) {
      subject.classes[key] = "present";
      added++;
    }
  }
  save();
  return added;
}

// Sets the status of one date: "present", "absent" or "cancelled".
// This also creates the class day if it did not exist.
export function setClassStatus(id, dateKey, status) {
  const subject = getSubject(id);
  if (!subject || !VALID_STATUSES.includes(status)) return;
  subject.classes[dateKey] = status;
  save();
}

// Removes the date from the subject (it is no longer a class day)
export function removeClass(id, dateKey) {
  const subject = getSubject(id);
  if (!subject) return;
  delete subject.classes[dateKey];
  save();
}

// ---------- backup: export and import ----------

// Downloads all data as a .json file
export function exportData() {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "attendance-backup.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Replaces ALL current data with the contents of a backup file.
// Returns true on success, false if the file was not a valid backup.
export function importData(text) {
  try {
    const cleaned = cleanData(JSON.parse(text));
    if (!cleaned) return false;
    data = cleaned;
    return save();
  } catch (err) {
    console.error("Import failed:", err);
    return false;
  }
}