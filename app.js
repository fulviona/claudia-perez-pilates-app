const STORAGE_KEY = "claudia-perez-pilates-db-v1";
const DEFAULT_ADMIN = { username: "admin", password: "admin123" };
const WEEK_DAYS = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mer" },
  { id: 4, label: "Gio" },
  { id: 5, label: "Ven" },
  { id: 6, label: "Sab" },
];

let state = {
  currentUserId: null,
  isAdmin: false,
  selectedDate: null,
  calendarCursor: new Date(),
};

function initialDb() {
  return {
    users: [],
    courses: [
      { id: crypto.randomUUID(), name: "Pilates Reformer", duration: 60, capacity: 4, mode: "group" },
      { id: crypto.randomUUID(), name: "Pilates Matwork", duration: 50, capacity: 8, mode: "group" },
      { id: crypto.randomUUID(), name: "Personal Pilates", duration: 60, capacity: 1, mode: "personal" },
    ],
    appointments: [],
    settings: {
      startHour: "08:00",
      endHour: "20:00",
      slotMinutes: 30,
      activeDays: [1, 2, 3, 4, 5, 6],
    },
  };
}

function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialDb();
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return initialDb();
  }
}

let db = loadDb();

function saveDb() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function qs(sel) {
  return document.querySelector(sel);
}

function qsa(sel) {
  return [...document.querySelectorAll(sel)];
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function combineDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00`);
}

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function addMinutes(timeStr, mins) {
  return minutesToTime(toMinutes(timeStr) + mins);
}

function isDayActive(dateStr) {
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return db.settings.activeDays.includes(day);
}

function buildSlotsForCourse(dateStr, course) {
  if (!isDayActive(dateStr)) return [];
  const slots = [];
  let current = db.settings.startHour;
  const endMins = toMinutes(db.settings.endHour);
  while (toMinutes(current) + course.duration <= endMins) {
    slots.push(current);
    current = addMinutes(current, db.settings.slotMinutes);
  }
  return slots;
}

function bookingOverlaps(aStart, aDuration, bStart, bDuration) {
  const aS = toMinutes(aStart);
  const aE = aS + aDuration;
  const bS = toMinutes(bStart);
  const bE = bS + bDuration;
  return aS < bE && bS < aE;
}

function activeBookingsOnDate(dateStr) {
  return db.appointments.filter((a) => a.date === dateStr && a.status !== "cancelled");
}

function availableSlots(dateStr, courseId) {
  const course = db.courses.find((c) => c.id === courseId);
  if (!course) return [];
  const dayBookings = activeBookingsOnDate(dateStr);
  return buildSlotsForCourse(dateStr, course).filter((slotTime) => {
    const overlapping = dayBookings.filter((b) => {
      const bCourse = db.courses.find((c) => c.id === b.courseId);
      if (!bCourse) return false;
      return bookingOverlaps(slotTime, course.duration, b.startTime, bCourse.duration);
    });
    return overlapping.length < course.capacity;
  });
}

function setupTabs() {
  qsa(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      qsa(".tab-btn").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      qsa(".tab-content").forEach((x) => x.classList.remove("active"));
      qs(`#${btn.dataset.tab}-tab`).classList.add("active");
    });
  });
}

function renderAuthAreas() {
  const clientArea = qs("#client-area");
  const adminArea = qs("#admin-area");
  if (state.isAdmin) {
    clientArea.classList.add("hidden");
    adminArea.classList.remove("hidden");
    renderAdminAll();
    return;
  }
  if (state.currentUserId) {
    adminArea.classList.add("hidden");
    clientArea.classList.remove("hidden");
    renderClientAll();
    return;
  }
  clientArea.classList.add("hidden");
  adminArea.classList.add("hidden");
}

function handleRegister() {
  qs("#register-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = String(formData.get("email")).trim().toLowerCase();
    const phone = String(formData.get("phone")).trim();

    const exists = db.users.some((u) => u.email === email);
    if (exists) {
      alert("Email gia registrata.");
      return;
    }

    db.users.push({
      id: crypto.randomUUID(),
      firstName: String(formData.get("firstName")).trim(),
      lastName: String(formData.get("lastName")).trim(),
      email,
      phone,
      privacyConsent: formData.get("privacyConsent") === "on",
      newsletterConsent: formData.get("newsletterConsent") === "on",
      approved: false,
      createdAt: new Date().toISOString(),
    });
    saveDb();
    e.target.reset();
    alert("Registrazione completata. Attendi l'abilitazione nel backoffice.");
    qsa(".tab-btn")[1].click();
  });
}

function handleLogin() {
  qs("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = String(formData.get("email")).trim().toLowerCase();
    const phone = String(formData.get("phone")).trim();
    const user = db.users.find((u) => u.email === email && u.phone === phone);
    if (!user) {
      alert("Credenziali non valide.");
      return;
    }
    state.currentUserId = user.id;
    state.isAdmin = false;
    state.selectedDate = null;
    renderAuthAreas();
  });
}

function handleAdminLogin() {
  qs("#admin-login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    if (
      String(formData.get("username")).trim() === DEFAULT_ADMIN.username &&
      String(formData.get("password")).trim() === DEFAULT_ADMIN.password
    ) {
      state.currentUserId = null;
      state.isAdmin = true;
      renderAuthAreas();
    } else {
      alert("Credenziali admin non valide.");
    }
  });
}

function monthName(date) {
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

function renderClientCalendar() {
  const grid = qs("#calendar-grid");
  const title = qs("#calendar-month-title");
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
    const thisDate = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    const thisDateStr = formatDate(thisDate);
    const cell = document.createElement("button");
    cell.className = "day-cell";
    cell.type = "button";
    cell.textContent = String(d);
    if (isDayActive(thisDateStr)) {
      cell.classList.add("active-day");
      cell.addEventListener("click", () => {
        state.selectedDate = thisDateStr;
        renderClientAll();
      });
    }
    if (state.selectedDate === thisDateStr) {
      cell.classList.add("selected");
    }
    grid.appendChild(cell);
  }
}

function renderClientBookingOptions() {
  const selectedLabel = qs("#selected-day-label");
  const courseSelect = qs("#course-select");
  const slotSelect = qs("#slot-select");
  const bookBtn = qs("#book-btn");
  courseSelect.innerHTML = db.courses
    .map((c) => `<option value="${c.id}">${c.name} (${c.mode}, ${c.duration}m, cap.${c.capacity})</option>`)
    .join("");

  if (!state.selectedDate) {
    selectedLabel.textContent = "Seleziona un giorno dal calendario.";
    slotSelect.innerHTML = "";
    bookBtn.disabled = true;
    return;
  }

  selectedLabel.textContent = `Giorno selezionato: ${state.selectedDate}`;
  const selectedCourseId = courseSelect.value || db.courses[0]?.id;
  const slots = selectedCourseId ? availableSlots(state.selectedDate, selectedCourseId) : [];
  slotSelect.innerHTML = slots.map((s) => `<option value="${s}">${s}</option>`).join("");
  bookBtn.disabled = slots.length === 0;

  courseSelect.onchange = () => renderClientBookingOptions();
}

function renderMyBookings() {
  const target = qs("#my-bookings");
  const mine = db.appointments
    .filter((a) => a.userId === state.currentUserId)
    .sort((a, b) => new Date(`${a.date}T${a.startTime}`) - new Date(`${b.date}T${b.startTime}`));

  target.innerHTML = mine.length
    ? mine
        .map((a) => {
          const course = db.courses.find((c) => c.id === a.courseId);
          return `
          <div class="list-item">
            <div>
              <b>${a.date} ${a.startTime}</b> - ${course?.name || "Corso rimosso"}
              <span class="badge ${a.status}">${a.status}</span>
            </div>
            ${a.status === "booked" ? `<button data-cancel="${a.id}">Annulla</button>` : ""}
          </div>`;
        })
        .join("")
    : "<p>Nessuna prenotazione.</p>";

  qsa("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const appt = db.appointments.find((a) => a.id === btn.dataset.cancel);
      if (!appt) return;
      appt.status = "cancelled";
      saveDb();
      renderClientAll();
    });
  });
}

function renderClientAll() {
  const user = db.users.find((u) => u.id === state.currentUserId);
  if (!user) return;
  qs("#client-welcome").textContent = `Ciao ${user.firstName} ${user.lastName}`;
  const status = qs("#client-approval-status");
  status.textContent = user.approved
    ? "Account abilitato alla prenotazione."
    : "Account in attesa di approvazione dal backoffice.";
  status.className = `status ${user.approved ? "approved" : "pending"}`;
  renderClientCalendar();
  renderClientBookingOptions();
  renderMyBookings();

  qs("#book-btn").onclick = () => {
    if (!user.approved) {
      alert("Il tuo account non e ancora abilitato alle prenotazioni.");
      return;
    }
    const courseId = qs("#course-select").value;
    const startTime = qs("#slot-select").value;
    if (!state.selectedDate || !courseId || !startTime) return;
    const stillAvailable = availableSlots(state.selectedDate, courseId).includes(startTime);
    if (!stillAvailable) {
      alert("Slot non piu disponibile, aggiorna la pagina.");
      return;
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
    saveDb();
    renderClientAll();
  };
}

function setupClientCalendarNav() {
  qs("#prev-month").addEventListener("click", () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
    renderClientAll();
  });
  qs("#next-month").addEventListener("click", () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
    renderClientAll();
  });
}

function setupLogout() {
  qs("#client-logout").addEventListener("click", () => {
    state.currentUserId = null;
    renderAuthAreas();
  });
  qs("#admin-logout").addEventListener("click", () => {
    state.isAdmin = false;
    renderAuthAreas();
  });
}

function setupAdminTabs() {
  qsa(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      qsa(".admin-tab-btn").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      qsa(".admin-tab").forEach((x) => x.classList.remove("active"));
      qs(`#admin-${btn.dataset.adminTab}`).classList.add("active");
    });
  });
}

function renderUsersTable() {
  const el = qs("#users-table");
  if (!db.users.length) {
    el.innerHTML = "<p>Nessun utente registrato.</p>";
    return;
  }
  el.innerHTML = db.users
    .map(
      (u) => `
    <div class="list-item">
      <div>
        <b>${u.firstName} ${u.lastName}</b> - ${u.email} - ${u.phone}<br />
        Privacy: ${u.privacyConsent ? "si" : "no"} | Newsletter: ${u.newsletterConsent ? "si" : "no"}
      </div>
      <button data-approve="${u.id}">
        ${u.approved ? "Disabilita prenotazioni" : "Abilita prenotazioni"}
      </button>
    </div>`
    )
    .join("");
  qsa("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = db.users.find((u) => u.id === btn.dataset.approve);
      if (!user) return;
      user.approved = !user.approved;
      saveDb();
      renderUsersTable();
      renderAnalytics();
    });
  });
}

function renderAdminSlots() {
  const dateInput = qs("#admin-date");
  if (!dateInput.value) dateInput.value = formatDate(new Date());
  const date = dateInput.value;
  const slotsBox = qs("#admin-slots");
  if (!isDayActive(date)) {
    slotsBox.innerHTML = "<p>Giorno non attivo.</p>";
    return;
  }
  const baseSlots = [];
  let t = db.settings.startHour;
  while (toMinutes(t) < toMinutes(db.settings.endHour)) {
    baseSlots.push(t);
    t = addMinutes(t, db.settings.slotMinutes);
  }
  const busy = activeBookingsOnDate(date).map((a) => a.startTime);
  slotsBox.innerHTML = baseSlots
    .map((s) => `<div class="slot-box ${busy.includes(s) ? "slot-busy" : "slot-free"}">${s} - ${busy.includes(s) ? "Occupato" : "Libero"}</div>`)
    .join("");
}

function renderAdminBookings() {
  const box = qs("#admin-bookings");
  const all = [...db.appointments].sort((a, b) => new Date(`${a.date}T${a.startTime}`) - new Date(`${b.date}T${b.startTime}`));
  box.innerHTML = all.length
    ? all
        .map((a) => {
          const user = db.users.find((u) => u.id === a.userId);
          const course = db.courses.find((c) => c.id === a.courseId);
          return `
          <div class="list-item">
            <div>
              <b>${a.date} ${a.startTime}</b> - ${course?.name || "Corso rimosso"} - ${user?.firstName || "?"} ${user?.lastName || ""}
              <span class="badge ${a.status}">${a.status}</span>
            </div>
            <div>
              <select data-status="${a.id}">
                <option ${a.status === "booked" ? "selected" : ""} value="booked">prenotato</option>
                <option ${a.status === "completed" ? "selected" : ""} value="completed">presente</option>
                <option ${a.status === "no-show" ? "selected" : ""} value="no-show">no-show</option>
                <option ${a.status === "cancelled" ? "selected" : ""} value="cancelled">annullato</option>
              </select>
              <input data-move-date="${a.id}" type="date" value="${a.date}" />
              <input data-move-time="${a.id}" type="time" value="${a.startTime}" />
              <button data-move="${a.id}">Sposta</button>
            </div>
          </div>`;
        })
        .join("")
    : "<p>Nessun appuntamento.</p>";

  qsa("[data-status]").forEach((el) => {
    el.addEventListener("change", () => {
      const appt = db.appointments.find((a) => a.id === el.dataset.status);
      if (!appt) return;
      appt.status = el.value;
      saveDb();
      renderAdminAll();
    });
  });

  qsa("[data-move]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.move;
      const appt = db.appointments.find((a) => a.id === id);
      if (!appt) return;
      const date = qs(`[data-move-date="${id}"]`).value;
      const time = qs(`[data-move-time="${id}"]`).value;
      if (!date || !time) return;
      appt.date = date;
      appt.startTime = time;
      saveDb();
      renderAdminAll();
    });
  });
}

function renderActiveDays() {
  const wrap = qs("#active-days");
  wrap.innerHTML = WEEK_DAYS.map(
    (d) =>
      `<label class="checkbox"><input type="checkbox" value="${d.id}" ${db.settings.activeDays.includes(d.id) ? "checked" : ""} />${d.label}</label>`
  ).join("");
}

function renderCoursesList() {
  const box = qs("#courses-list");
  box.innerHTML = db.courses
    .map(
      (c) => `<div class="list-item">
        <div><b>${c.name}</b> - ${c.mode} - ${c.duration} min - capienza ${c.capacity}</div>
        <button data-delete-course="${c.id}">Elimina</button>
      </div>`
    )
    .join("");
  qsa("[data-delete-course]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hasBooking = db.appointments.some((a) => a.courseId === btn.dataset.deleteCourse && a.status !== "cancelled");
      if (hasBooking) {
        alert("Non puoi eliminare un corso con appuntamenti attivi.");
        return;
      }
      db.courses = db.courses.filter((c) => c.id !== btn.dataset.deleteCourse);
      saveDb();
      renderCoursesList();
    });
  });
}

function renderAnalytics() {
  const totalUsers = db.users.length;
  const totalBooked = db.appointments.filter((a) => a.status === "booked").length;
  const totalCompleted = db.appointments.filter((a) => a.status === "completed").length;
  const totalNoShow = db.appointments.filter((a) => a.status === "no-show").length;
  const totalCancelled = db.appointments.filter((a) => a.status === "cancelled").length;

  qs("#analytics-overview").innerHTML = `
    <div class="stat-card"><b>Clienti registrati</b><br/>${totalUsers}</div>
    <div class="stat-card"><b>Corsi prenotati attivi</b><br/>${totalBooked}</div>
    <div class="stat-card"><b>Corsi frequentati</b><br/>${totalCompleted}</div>
    <div class="stat-card"><b>No-show</b><br/>${totalNoShow}</div>
    <div class="stat-card"><b>Annullati</b><br/>${totalCancelled}</div>
  `;

  qs("#analytics-users").innerHTML = db.users
    .map((u) => {
      const mine = db.appointments.filter((a) => a.userId === u.id);
      const booked = mine.filter((a) => a.status === "booked").length;
      const completed = mine.filter((a) => a.status === "completed").length;
      const noShow = mine.filter((a) => a.status === "no-show").length;
      return `<div class="list-item"><div><b>${u.firstName} ${u.lastName}</b> - ${u.email}</div><div>Prenotati: ${booked} | Presenti: ${completed} | No-show: ${noShow}</div></div>`;
    })
    .join("") || "<p>Nessun dato disponibile.</p>";
}

function renderSettingsForm() {
  const form = qs("#availability-form");
  form.startHour.value = db.settings.startHour;
  form.endHour.value = db.settings.endHour;
  form.slotMinutes.value = db.settings.slotMinutes;
  renderActiveDays();
}

function renderAdminAll() {
  renderUsersTable();
  renderAdminSlots();
  renderAdminBookings();
  renderSettingsForm();
  renderCoursesList();
  renderAnalytics();
}

function setupAdminEvents() {
  qs("#admin-date").addEventListener("change", renderAdminSlots);

  qs("#availability-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const selectedDays = qsa("#active-days input:checked").map((x) => Number(x.value));
    db.settings = {
      startHour: String(fd.get("startHour")),
      endHour: String(fd.get("endHour")),
      slotMinutes: Number(fd.get("slotMinutes")),
      activeDays: selectedDays,
    };
    saveDb();
    alert("Impostazioni salvate.");
    renderAdminAll();
  });

  qs("#course-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    db.courses.push({
      id: crypto.randomUUID(),
      name: String(fd.get("name")).trim(),
      duration: Number(fd.get("duration")),
      capacity: Number(fd.get("capacity")),
      mode: String(fd.get("mode")),
    });
    saveDb();
    e.target.reset();
    renderAdminAll();
  });
}

function boot() {
  setupTabs();
  setupAdminTabs();
  handleRegister();
  handleLogin();
  handleAdminLogin();
  setupClientCalendarNav();
  setupLogout();
  setupAdminEvents();
  renderAuthAreas();
}

boot();
