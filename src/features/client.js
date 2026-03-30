import { availableSlots, canBookDate, isFutureOrToday, WEEK_DAYS } from "../core/calendar.js";
import { monthName, formatDate, toMinutes } from "../utils/date.js";
import { qs, qsa, openTabById, setupTabs } from "../utils/dom.js";
import { saveDb } from "../core/store.js";
import { bookingBadge } from "../components/index.js";

export function bootClient(db, state) {
  setupTabs();
  handleRegister(db);
  handleLogin(db, state);
  setupResetPasswordDemo(db);
  setupCalendarNav(db, state);
  setupLogout(db, state);
  renderAuth(db, state);
}

function renderAuth(db, state) {
  const authCard = qs(".auth-card");
  const clientArea = qs("#client-area");
  if (!authCard || !clientArea) return;
  if (state.currentUserId) {
    authCard.classList.add("hidden");
    clientArea.classList.remove("hidden");
    renderClient(db, state);
  } else {
    authCard.classList.remove("hidden");
    clientArea.classList.add("hidden");
  }
}

function handleRegister(db) {
  const form = qs("#register-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get("email")).trim().toLowerCase();
    const password = String(fd.get("password")).trim();
    if (password.length < 6) return alert("La password deve avere almeno 6 caratteri.");
    if (db.users.some((u) => u.email === email)) return alert("Email gia registrata.");

    db.users.push({
      id: crypto.randomUUID(),
      firstName: String(fd.get("firstName")).trim(),
      lastName: String(fd.get("lastName")).trim(),
      email,
      phone: String(fd.get("phone")).trim(),
      password,
      privacyConsent: fd.get("privacyConsent") === "on",
      newsletterConsent: fd.get("newsletterConsent") === "on",
      approved: false,
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    e.target.reset();
    alert("Registrazione completata. Attendi l'abilitazione dal backoffice.");
    const loginTab = qsa(".tab-btn").find((b) => b.dataset.tab === "login");
    if (loginTab) loginTab.click();
  });
}

function handleLogin(db, state) {
  const form = qs("#login-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get("email")).trim().toLowerCase();
    const password = String(fd.get("password")).trim();
    const user = db.users.find((u) => u.email === email && u.password === password);
    if (!user) return alert("Credenziali non valide.");
    state.currentUserId = user.id;
    state.selectedDate = null;
    state.calendarCursor = new Date();
    renderAuth(db, state);
  });
}

function setupResetPasswordDemo(db) {
  const openBtn = qs("#open-reset-password");
  const backBtn = qs("#back-to-login");
  const form = qs("#reset-password-form");
  if (!openBtn || !backBtn || !form) return;

  openBtn.addEventListener("click", () => openTabById("reset-tab"));
  backBtn.addEventListener("click", () => {
    const loginTabBtn = qsa(".tab-btn").find((b) => b.dataset.tab === "login");
    if (loginTabBtn) loginTabBtn.click();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get("email")).trim().toLowerCase();
    const newPassword = String(fd.get("newPassword")).trim();
    if (newPassword.length < 6) return alert("La nuova password deve avere almeno 6 caratteri.");
    const user = db.users.find((u) => u.email === email);
    if (!user) return alert("Email non trovata.");
    user.password = newPassword;
    saveDb(db);
    form.reset();
    alert("Password aggiornata. Ora puoi accedere.");
    const loginTabBtn = qsa(".tab-btn").find((b) => b.dataset.tab === "login");
    if (loginTabBtn) loginTabBtn.click();
  });
}

function renderCalendar(db, state) {
  const grid = qs("#calendar-grid");
  const title = qs("#calendar-month-title");
  if (!grid || !title) return;

  const cursor = state.calendarCursor;
  title.textContent = monthName(cursor);
  grid.innerHTML = "";
  WEEK_DAYS.forEach((d) => {
    const h = document.createElement("div");
    h.className = "day-name";
    h.textContent = d.label;
    grid.appendChild(h);
  });

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const startOffset = first.getDay();
  for (let i = 0; i < startOffset; i += 1) {
    const empty = document.createElement("div");
    empty.className = "day-cell";
    grid.appendChild(empty);
  }

  for (let d = 1; d <= days; d += 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    const dateStr = formatDate(date);
    const cell = document.createElement("button");
    cell.className = "day-cell";
    cell.type = "button";
    cell.textContent = String(d);
    if (canBookDate(db, dateStr)) {
      cell.classList.add("active-day");
      cell.addEventListener("click", () => {
        state.selectedDate = dateStr;
        renderClient(db, state);
      });
    } else if (!isFutureOrToday(dateStr)) {
      cell.classList.add("past-day");
      cell.disabled = true;
    }
    if (state.selectedDate === dateStr) cell.classList.add("selected");
    grid.appendChild(cell);
  }
}

function renderBookingOptions(db, state) {
  const selectedLabel = qs("#selected-day-label");
  const courseSelect = qs("#course-select");
  const slotSelect = qs("#slot-select");
  const bookBtn = qs("#book-btn");
  if (!selectedLabel || !courseSelect || !slotSelect || !bookBtn) return;

  courseSelect.innerHTML = db.courses
    .map((c) => `<option value="${c.id}">${c.name} (${c.mode}, ${c.duration}m, cap.${c.capacity})</option>`)
    .join("");

  if (!state.selectedDate) {
    selectedLabel.textContent = "Seleziona un giorno disponibile dal calendario.";
    slotSelect.innerHTML = "";
    bookBtn.disabled = true;
    return;
  }

  selectedLabel.textContent = `Giorno selezionato: ${state.selectedDate}`;
  const selectedCourseId = courseSelect.value || db.courses[0]?.id;
  const course = db.courses.find((c) => c.id === selectedCourseId);
  let slots = selectedCourseId ? availableSlots(db, state.selectedDate, selectedCourseId) : [];

  // Vincolo: per la data di oggi, niente slot in passato.
  // Inoltre mostriamo solo il "primo orario successivo libero".
  const todayStr = formatDate(new Date());
  // La regola "solo primo slot successivo libero" si applica ai PERSONAL (prenotazione autonoma).
  if (state.selectedDate === todayStr && course?.mode === "personal") {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const eligible = slots.filter((s) => toMinutes(s.time) >= nowMins);
    slots = eligible.length ? [eligible[0]] : [];
  }

  slotSelect.innerHTML = slots
    .map((s) => {
      const seats = course?.mode === "group" ? ` - posti liberi: ${s.remaining}/${s.capacity}` : "";
      return `<option value="${s.time}">${s.time}${seats}</option>`;
    })
    .join("");
  bookBtn.disabled = slots.length === 0;
  courseSelect.onchange = () => renderBookingOptions(db, state);
}

function canCancelAppointment(appointment) {
  const start = new Date(`${appointment.date}T${appointment.startTime}:00`);
  const cutoff = new Date(start.getTime() - 30 * 60 * 1000);
  return new Date() <= cutoff;
}

function renderMyBookings(db, state) {
  const target = qs("#my-bookings");
  if (!target) return;
  const mine = db.appointments
    .filter((a) => a.userId === state.currentUserId)
    .sort((a, b) => new Date(`${a.date}T${a.startTime}`) - new Date(`${b.date}T${b.startTime}`));
  target.innerHTML = mine.length
    ? mine
        .map((a) => {
          const course = db.courses.find((c) => c.id === a.courseId);
          const cancelAllowed = a.status === "booked" && canCancelAppointment(a);
          return `<div class="list-item">
            <div><b>${a.date} ${a.startTime}</b> - ${course?.name || "Corso rimosso"} ${bookingBadge(a.status)}</div>
            ${
              a.status === "booked"
                ? cancelAllowed
                  ? `<button data-cancel="${a.id}">Annulla</button>`
                  : `<button disabled title="Annullabile solo entro 30 minuti prima">Annulla non disponibile</button>`
                : ""
            }
          </div>`;
        })
        .join("")
    : "<p>Nessuna prenotazione.</p>";

  qsa("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const appt = db.appointments.find((a) => a.id === btn.dataset.cancel);
      if (!appt) return;
      if (!canCancelAppointment(appt)) {
        alert("Puoi annullare solo fino a 30 minuti prima dell'inizio.");
        renderClient(db, state);
        return;
      }
      appt.status = "cancelled";
      saveDb(db);
      renderClient(db, state);
    });
  });
}

function renderClient(db, state) {
  const user = db.users.find((u) => u.id === state.currentUserId);
  if (!user) return;
  qs("#client-welcome").textContent = `Ciao ${user.firstName} ${user.lastName}`;
  const status = qs("#client-approval-status");
  status.textContent = user.approved ? "Account abilitato alla prenotazione." : "Account in attesa di approvazione dal backoffice.";
  status.className = `status ${user.approved ? "approved" : "pending"}`;

  renderCalendar(db, state);
  renderBookingOptions(db, state);
  renderMyBookings(db, state);

  qs("#book-btn").onclick = () => {
    if (!user.approved) return alert("Il tuo account non e ancora abilitato alle prenotazioni.");
    const courseId = qs("#course-select").value;
    const startTime = qs("#slot-select").value;
    if (!state.selectedDate || !courseId || !startTime) return;
    if (!isFutureOrToday(state.selectedDate)) return alert("Puoi prenotare solo da oggi in poi.");
    const allSlots = availableSlots(db, state.selectedDate, courseId);
    const stillAvailable = allSlots.some((s) => s.time === startTime);
    if (!stillAvailable) return alert("Slot non piu disponibile.");

    // Enforcement: per oggi si accetta solo il primo slot libero successivo all'ora corrente.
    const course = db.courses.find((c) => c.id === courseId);
    const todayStr = formatDate(new Date());
    if (state.selectedDate === todayStr && course?.mode === "personal") {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const eligible = allSlots.filter((s) => toMinutes(s.time) >= nowMins);
      const nextFree = eligible.length ? eligible[0]?.time : null;
      if (!nextFree || startTime !== nextFree) {
        return alert("Per oggi puoi prenotare solo il primo orario disponibile dopo l'ora attuale.");
      }
    }

    db.appointments.push({
      id: crypto.randomUUID(),
      userId: user.id,
      courseId,
      date: state.selectedDate,
      startTime,
      status: "booked",
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    alert("Prenotazione confermata. Ricorda: puoi annullarla entro e non oltre 30 minuti prima dell'inizio sessione.");
    renderClient(db, state);
  };
}

function setupCalendarNav(db, state) {
  const prev = qs("#prev-month");
  const next = qs("#next-month");
  if (prev) {
    prev.addEventListener("click", () => {
      state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
      renderClient(db, state);
    });
  }
  if (next) {
    next.addEventListener("click", () => {
      state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
      renderClient(db, state);
    });
  }
}

function setupLogout(db, state) {
  const btn = qs("#client-logout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    state.currentUserId = null;
    renderAuth(db, state);
  });
}
