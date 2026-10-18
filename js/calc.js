// ==========================================================
// calc.js — all attendance math
//
// Terms used below (for one subject, as of "today"):
//   held          = class days up to and including today, not cancelled
//   absent        = held classes you marked absent
//   attended      = held - absent
//   percentage    = attended / held * 100
//   upcoming      = class days after today, not cancelled, not marked absent
//   plannedAbsent = class days after today that you already marked absent
//   total         = held + upcoming + plannedAbsent   (whole semester, cancelled excluded)
// Cancelled classes are removed from every count.
// ==========================================================

import { round1 } from "./utils.js";

// When to show the orange warning:
export const WARN_MISS = 2;    // you can miss 2 or fewer more classes
export const WARN_MARGIN = 3;  // or you are within 3 percentage points of the limit

const EPS = 1e-9; // protects against tiny decimal errors such as 29.999999999

function moreClasses(n) {
  return `${n} more ${n === 1 ? "class" : "classes"}`;
}

function classes(n) {
  return `${n} ${n === 1 ? "class" : "classes"}`;
}

// What state is this date in? Used to colour the calendar.
// Returns: "none" | "present" | "absent" | "cancelled" | "upcoming"
export function getDayState(subject, dateKey, today) {
  const status = subject.classes[dateKey];
  if (!status) return "none";
  if (status === "absent") return "absent";
  if (status === "cancelled") return "cancelled";
  return dateKey <= today ? "present" : "upcoming";
}

export function calculate(subject, today) {
  const required = Number(subject.required);

  let held = 0;
  let absent = 0;
  let cancelled = 0;
  let upcoming = 0;
  let plannedAbsent = 0;

  for (const [dateKey, status] of Object.entries(subject.classes)) {
    if (status === "cancelled") {
      cancelled++;
      continue;
    }
    if (dateKey <= today) {
      held++;
      if (status === "absent") absent++;
    } else if (status === "absent") {
      plannedAbsent++;
    } else {
      upcoming++;
    }
  }

  const attended = held - absent;
  const total = held + upcoming + plannedAbsent;
  const percentage = held > 0 ? (attended * 100) / held : null;

  const result = {
    required, held, attended, absent, cancelled, upcoming, plannedAbsent, total,
    percentage,        // null if no class has been held yet
    canMiss: 0,        // how many more classes you can miss and still be OK
    mode: "schedule",  // "schedule" = future classes are marked, "open" = they are not
    finalIfAll: null,  // final % if you attend every remaining class
    recoverIn: null,   // classes in a row you must attend to get back to the limit
    status: "empty",   // "empty" | "ok" | "warn" | "danger"
    message: ""
  };

  if (total === 0) {
    result.message = "No classes added yet. Open the calendar to add class days.";
    return result;
  }

  // ---- How many more classes can be missed? ----
  const hasFuture = upcoming + plannedAbsent > 0;
  let canMissRaw;

  if (hasFuture) {
    // Future class days are marked on the calendar, so the semester total is known.
    // Minimum classes you must have attended by the end:
    const neededAtEnd = Math.ceil((required * total) / 100 - EPS);
    // If you attend every upcoming class you end with (attended + upcoming).
    // Whatever is above neededAtEnd is how many you may skip.
    canMissRaw = attended + upcoming - neededAtEnd;
    result.mode = "schedule";
    result.finalIfAll = ((attended + upcoming) * 100) / total;
    result.canMiss = Math.max(0, Math.min(canMissRaw, upcoming));
  } else {
    // No future classes marked. Count how many classes in a row you could skip
    // from now (each skipped class also counts as a held class):
    // attended / (held + k) >= required / 100   =>   k <= attended*100/required - held
    canMissRaw = Math.floor((attended * 100) / required - held + EPS);
    result.mode = "open";
    result.finalIfAll = percentage;
    result.canMiss = Math.max(0, canMissRaw);
  }

  // ---- Are you below the limit right now? (integers only, no rounding) ----
  const belowNow = held > 0 && attended * 100 < required * held;

  if (belowNow && required < 100) {
    // Smallest k with (attended + k) / (held + k) >= required / 100
    result.recoverIn = Math.ceil((required * held - 100 * attended) / (100 - required) - EPS);
  }

  // ---- Decide the status ----
  const danger = belowNow || canMissRaw < 0;
  const warn =
    !danger &&
    (canMissRaw <= WARN_MISS ||
      (percentage !== null && percentage - required <= WARN_MARGIN));

  if (danger) {
    result.status = "danger";
    if (belowNow) {
      if (result.recoverIn === null) {
        result.message = `Below ${required}%. This level can no longer be reached.`;
      } else if (!hasFuture || result.recoverIn <= upcoming) {
        result.message = `Below ${required}%. Attend the next ${classes(result.recoverIn)} in a row to get back to ${required}%.`;
      } else {
        result.message = `Below ${required}%. Even attending every remaining class, you will finish at ${round1(result.finalIfAll)}%.`;
      }
    } else {
      result.message = `Your planned absences will drop you to ${round1(result.finalIfAll)}% by the end, below ${required}%.`;
    }
  } else if (warn) {
    result.status = "warn";
    result.message =
      result.canMiss >= 1
        ? `Careful, close to the limit. You can miss only ${moreClasses(result.canMiss)}.`
        : "At the limit. You cannot miss any more classes.";
  } else {
    result.status = "ok";
    result.message =
      result.mode === "schedule"
        ? `You can miss ${moreClasses(result.canMiss)} out of ${upcoming} upcoming.`
        : `You can skip the next ${classes(result.canMiss)} and stay at or above ${required}%.`;
  }

  return result;
}