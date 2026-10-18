// ==========================================================
// subjects.js — the add / edit / delete subject form
//
// This file only handles the form. Switching screens is done by app.js,
// which passes in three functions (callbacks) when it calls initSubjects():
//   onSaved(subject, isNew)  - called after a subject is saved
//   onDeleted()              - called after a subject is deleted
//   onBack(editingId)        - called when the back arrow is tapped
//                              (editingId is null when adding a new subject)
// ==========================================================

import { getSubjects, getSubject, addSubject, updateSubject, deleteSubject } from "./storage.js";
import { showToast } from "./utils.js";

const form = document.getElementById("subject-form");
const titleEl = document.getElementById("subject-form-title");
const idInput = document.getElementById("subject-id");
const nameInput = document.getElementById("subject-name");
const requiredInput = document.getElementById("subject-required");
const deleteBtn = document.getElementById("btn-subject-delete");
const backBtn = document.getElementById("btn-subject-back");

const DEFAULT_REQUIRED = 75;

let callbacks = {
  onSaved() {},
  onDeleted() {},
  onBack() {}
};

// Called once by app.js when the page starts
export function initSubjects(cb) {
  callbacks = { ...callbacks, ...cb };

  form.addEventListener("submit", handleSubmit);
  deleteBtn.addEventListener("click", handleDelete);
  backBtn.addEventListener("click", () => callbacks.onBack(idInput.value || null));
}

// Fills the form. Pass a subject id to edit it, or nothing to add a new one.
// app.js shows the screen after calling this.
export function openSubjectForm(subjectId = null) {
  const subject = subjectId ? getSubject(subjectId) : null;

  if (subject) {
    titleEl.textContent = "Edit subject";
    idInput.value = subject.id;
    nameInput.value = subject.name;
    requiredInput.value = subject.required;
    deleteBtn.hidden = false;
  } else {
    titleEl.textContent = "Add subject";
    idInput.value = "";
    nameInput.value = "";
    requiredInput.value = DEFAULT_REQUIRED;
    deleteBtn.hidden = true;
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const id = idInput.value;
  const name = nameInput.value.trim();
  const required = Number(requiredInput.value);

  if (!name) {
    showToast("Enter a subject name.");
    nameInput.focus();
    return;
  }

  if (!Number.isInteger(required) || required < 1 || required > 100) {
    showToast("Required attendance must be a whole number from 1 to 100.");
    requiredInput.focus();
    return;
  }

  // Two subjects with the same name would be confusing on the dashboard
  const duplicate = getSubjects().some(
    (s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    showToast("You already have a subject with this name.");
    nameInput.focus();
    return;
  }

  if (id) {
    const updated = updateSubject(id, { name, required });
    showToast("Subject updated.");
    callbacks.onSaved(updated, false);
  } else {
    const created = addSubject({ name, required });
    showToast("Subject added. Now mark its class days.");
    callbacks.onSaved(created, true);
  }
}

function handleDelete() {
  const id = idInput.value;
  const subject = getSubject(id);
  if (!subject) return;

  const ok = confirm(
    `Delete "${subject.name}" and all its attendance records?\nThis cannot be undone.`
  );
  if (!ok) return;

  deleteSubject(id);
  showToast("Subject deleted.");
  callbacks.onDeleted();
}