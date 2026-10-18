// ==========================================================
// app.js — starts the app, switches screens, connects the other files
//
// Screens: "dashboard" | "subject" (add/edit form) | "calendar"
// Navigation uses the browser history, so the phone's back button and
// the browser's back arrow move between screens instead of leaving the site.
// ==========================================================

import { initDashboard, renderDashboard } from "./dashboard.js";
import { initSubjects, openSubjectForm } from "./subjects.js";
import { initCalendar, openCalendar } from "./calendar.js";
import { getSubject, exportData, importData } from "./storage.js";
import { showToast } from "./utils.js";

const screens = {
  dashboard: document.getElementById("screen-dashboard"),
  subject: document.getElementById("screen-subject"),
  calendar: document.getElementById("screen-calendar")
};

let currentScreen = "dashboard";

// ---------- showing a screen ----------

// Prepares and shows a screen. Returns what was actually shown
// (falls back to the dashboard if the subject no longer exists).
function show(screen, id = null) {
  const needsSubject = screen === "calendar" || (screen === "subject" && id);
  if (needsSubject && !getSubject(id)) {
    screen = "dashboard";
    id = null;
  }

  if (screen === "calendar") openCalendar(id);
  else if (screen === "subject") openSubjectForm(id);
  else renderDashboard();

  for (const [name, node] of Object.entries(screens)) {
    node.hidden = name !== screen;
  }
  currentScreen = screen;
  window.scrollTo(0, 0);

  return { screen, id };
}

// ---------- navigation with browser history ----------
// Each history entry stores { screen, id, depth }. depth is 0 for the
// first entry (the dashboard) and goes up by 1 for each screen opened.

function navigate(screen, { id = null, replace = false } = {}) {
  const shown = show(screen, id);
  const depth = history.state?.depth ?? 0;
  const state = { screen: shown.screen, id: shown.id, depth: replace ? depth : depth + 1 };

  if (replace) history.replaceState(state, "");
  else history.pushState(state, "");
}

function goBack() {
  if ((history.state?.depth ?? 0) > 0) history.back();
  else navigate("dashboard", { replace: true });
}

// Phone back button / browser back arrow
window.addEventListener("popstate", (event) => {
  const state = event.state || { screen: "dashboard", id: null };
  show(state.screen, state.id);
});

// ---------- connect the modules ----------

initDashboard((subjectId) => navigate("calendar", { id: subjectId }));

initSubjects({
  onBack: goBack,
  onSaved(subject, isNew) {
    if (isNew) {
      // go straight to the new subject's calendar to mark its class days
      navigate("calendar", { id: subject.id, replace: true });
    } else {
      goBack(); // back to the calendar, which redraws with the new name/percentage
    }
  },
  onDeleted() {
    // stack was: dashboard > calendar > edit form, so go back two entries
    if ((history.state?.depth ?? 0) >= 2) history.go(-2);
    else navigate("dashboard", { replace: true });
  }
});

initCalendar({
  onBack: goBack,
  onEdit: (subjectId) => navigate("subject", { id: subjectId })
});

document.getElementById("btn-add-subject").addEventListener("click", () => {
  navigate("subject", { id: null });
});

// ---------- backup: export / import ----------

const importFile = document.getElementById("import-file");

document.getElementById("btn-export").addEventListener("click", () => {
  exportData();
  showToast("Backup downloaded.");
});

document.getElementById("btn-import").addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  importFile.value = ""; // lets you pick the same file again later
  if (!file) return;

  const ok = confirm("This will replace ALL current data with the backup file. Continue?");
  if (!ok) return;

  try {
    const text = await file.text();
    if (importData(text)) {
      showToast("Backup imported.");
      renderDashboard();
    } else {
      showToast("That file is not a valid backup.");
    }
  } catch (err) {
    console.error(err);
    showToast("Could not read that file.");
  }
});

// If the page stays open overnight, refresh the numbers when you come back to it
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentScreen === "dashboard") renderDashboard();
});

// ---------- start ----------
history.replaceState({ screen: "dashboard", id: null, depth: 0 }, "");
show("dashboard");