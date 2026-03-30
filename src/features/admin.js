import { WEEK_DAYS, buildBaseSlots, getSlotPlan, isDayActive, setSlotPlan, slotIsOccupied } from "../core/calendar.js";
import { formatDate } from "../utils/date.js";
import { qs, qsa } from "../utils/dom.js";
import { saveDb } from "../core/store.js";
import { bookingBadge } from "../components/index.js";

const DEFAULT_ADMIN = { username: "admin", password: "admin123" };

export function bootAdmin(db, state) {
  setupAdminTabs();
  setupAdminEvents(db);
  setupAdminLogin(db, state);
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

function renderUsersTable(db) {
  const el = qs("#users-table");
  if (!el) return;
  if (!db.users.length) return (el.innerHTML = "<p>Nessun utente registrato.</p>");
  el.innerHTML = db.users
    .map(
      (u) => `<div class="list-item">
        <div><b>${u.firstName} ${u.lastName}</b> - ${u.email} - ${u.phone}<br/>Privacy: ${u.privacyConsent ? "si" : "no"} | Newsletter: ${u.newsletterConsent ? "si" : "no"}</div>
        <button data-approve="${u.id}">${u.approved ? "Disabilita prenotazioni" : "Abilita prenotazioni"}</button>
      </div>`
    )
    .join("");
  qsa("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = db.users.find((u) => u.id === btn.dataset.approve);
      if (!user) return;
      user.approved = !user.approved;
      saveDb(db);
      renderAdminAll(db);
    });
  });
}

function renderAdminSlots(db) {
  const dateInput = qs("#admin-date");
  const slotsBox = qs("#admin-slots");
  if (!dateInput || !slotsBox) return;
  if (!dateInput.value) dateInput.value = formatDate(new Date());
  const date = dateInput.value;
  if (!isDayActive(db, date)) return (slotsBox.innerHTML = "<p>Giorno non attivo.</p>");

  const baseSlots = buildBaseSlots(db);

  const groupCourses = db.courses.filter((c) => c.mode === "group");

  slotsBox.innerHTML = baseSlots
    .map((s) => {
      const plan = getSlotPlan(db, date, s);
      const isBlocked = Boolean(plan?.blocked);
      const isBusy = slotIsOccupied(db, date, s) || isBlocked;
      const isPlanned = Boolean(plan?.groupCourseId) && !isBlocked;
      const groupCourseId = plan?.groupCourseId || "";
      const blockPersonal = Boolean(plan?.blockPersonal);
      const plannedCourse = db.courses.find((c) => c.id === groupCourseId);
      const groupOptions =
        `<option value="">— nessun corso gruppo —</option>` +
        groupCourses.map((c) => `<option ${c.id === groupCourseId ? "selected" : ""} value="${c.id}">${c.name}</option>`).join("");
      const statusText = isBlocked ? "Bloccato" : isBusy ? "Occupato" : isPlanned ? "Programmato" : "Libero";
      const statusClass = isBlocked || isBusy ? "slot-status busy" : isPlanned ? "slot-status planned" : "slot-status free";
      const plannedText = plannedCourse ? `<div class="slot-meta">Sessione: ${plannedCourse.name}</div>` : "";

      return `<div class="slot-box ${isBusy ? "slot-busy" : "slot-free"}">
        <div class="slot-header-row"><b>${s}</b><span class="${statusClass}">${statusText}</span></div>
        ${plannedText}
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <label style="flex:1; min-width:180px;">
            Corso gruppo
            <select data-plan-group="${s}">${groupOptions}</select>
          </label>
          <label class="checkbox" style="min-width:170px;">
            <input type="checkbox" data-plan-block-personal="${s}" ${blockPersonal ? "checked" : ""} />
            Blocca personal
          </label>
          <button class="btn-secondary" data-plan-toggle-block="${s}">${isBlocked ? "Sblocca slot" : "Blocca slot"}</button>
        </div>
      </div>`;
    })
    .join("");

  // Handlers: aggiorna piani slot
  qsa("[data-plan-group]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const time = sel.dataset.planGroup;
      const plan = getSlotPlan(db, date, time) || {};
      const val = sel.value;
      if (!val) delete plan.groupCourseId;
      else plan.groupCourseId = val;
      setSlotPlan(db, date, time, Object.keys(plan).length ? plan : null);
      saveDb(db);
      renderAdminSlots(db);
    });
  });

  qsa("[data-plan-block-personal]").forEach((chk) => {
    chk.addEventListener("change", () => {
      const time = chk.dataset.planBlockPersonal;
      const plan = getSlotPlan(db, date, time) || {};
      plan.blockPersonal = chk.checked;
      setSlotPlan(db, date, time, Object.keys(plan).length ? plan : null);
      saveDb(db);
      renderAdminSlots(db);
    });
  });

  qsa("[data-plan-toggle-block]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const time = btn.dataset.planToggleBlock;
      const plan = getSlotPlan(db, date, time) || {};
      plan.blocked = !plan.blocked;
      setSlotPlan(db, date, time, Object.keys(plan).length ? plan : null);
      saveDb(db);
      renderAdminSlots(db);
    });
  });
}

function renderAdminBookings(db) {
  const box = qs("#admin-bookings");
  if (!box) return;
  const all = [...db.appointments].sort((a, b) => new Date(`${a.date}T${a.startTime}`) - new Date(`${b.date}T${b.startTime}`));
  box.innerHTML = all.length
    ? all
        .map((a) => {
          const user = db.users.find((u) => u.id === a.userId);
          const course = db.courses.find((c) => c.id === a.courseId);
          return `<div class="list-item">
            <div><b>${a.date} ${a.startTime}</b> - ${course?.name || "Corso rimosso"} - ${user?.firstName || "?"} ${user?.lastName || ""} ${bookingBadge(a.status)}</div>
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
      saveDb(db);
      renderAdminAll(db);
    });
  });

  qsa("[data-move]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.move;
      const appt = db.appointments.find((a) => a.id === id);
      if (!appt) return;
      appt.date = qs(`[data-move-date="${id}"]`).value;
      appt.startTime = qs(`[data-move-time="${id}"]`).value;
      saveDb(db);
      renderAdminAll(db);
    });
  });
}

function renderSettingsForm(db) {
  const form = qs("#availability-form");
  if (!form) return;
  form.startHour.value = db.settings.startHour;
  form.endHour.value = db.settings.endHour;
  form.slotMinutes.value = db.settings.slotMinutes;
  const wrap = qs("#active-days");
  wrap.innerHTML = WEEK_DAYS.map(
    (d) => `<label class="checkbox"><input type="checkbox" value="${d.id}" ${db.settings.activeDays.includes(d.id) ? "checked" : ""} />${d.label}</label>`
  ).join("");
}

function renderCourses(db) {
  const box = qs("#courses-list");
  if (!box) return;
  box.innerHTML = db.courses
    .map(
      (c) => `<div class="list-item"><div><b>${c.name}</b> - ${c.mode} - ${c.duration} min - capienza ${c.capacity}</div><button data-delete-course="${c.id}">Elimina</button></div>`
    )
    .join("");
  qsa("[data-delete-course]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hasBooking = db.appointments.some((a) => a.courseId === btn.dataset.deleteCourse && a.status !== "cancelled");
      if (hasBooking) return alert("Non puoi eliminare un corso con appuntamenti attivi.");
      db.courses = db.courses.filter((c) => c.id !== btn.dataset.deleteCourse);
      saveDb(db);
      renderAdminAll(db);
    });
  });
}

function renderAnalytics(db) {
  const overview = qs("#analytics-overview");
  const usersBox = qs("#analytics-users");
  if (!overview || !usersBox) return;
  overview.innerHTML = `
    <div class="stat-card"><b>Clienti registrati</b><br/>${db.users.length}</div>
    <div class="stat-card"><b>Corsi prenotati attivi</b><br/>${db.appointments.filter((a) => a.status === "booked").length}</div>
    <div class="stat-card"><b>Corsi frequentati</b><br/>${db.appointments.filter((a) => a.status === "completed").length}</div>
    <div class="stat-card"><b>No-show</b><br/>${db.appointments.filter((a) => a.status === "no-show").length}</div>
    <div class="stat-card"><b>Annullati</b><br/>${db.appointments.filter((a) => a.status === "cancelled").length}</div>
  `;
  usersBox.innerHTML =
    db.users
      .map((u) => {
        const mine = db.appointments.filter((a) => a.userId === u.id);
        return `<div class="list-item"><div><b>${u.firstName} ${u.lastName}</b> - ${u.email}</div><div>Prenotati: ${mine.filter((a) => a.status === "booked").length} | Presenti: ${mine.filter((a) => a.status === "completed").length} | No-show: ${mine.filter((a) => a.status === "no-show").length}</div></div>`;
      })
      .join("") || "<p>Nessun dato disponibile.</p>";
}

function renderAdminAll(db) {
  renderUsersTable(db);
  renderAdminSlots(db);
  renderAdminBookings(db);
  renderSettingsForm(db);
  renderCourses(db);
  renderAnalytics(db);
}

function setupAdminEvents(db) {
  const dateInput = qs("#admin-date");
  if (dateInput) dateInput.addEventListener("change", () => renderAdminSlots(db));

  const availabilityForm = qs("#availability-form");
  if (availabilityForm) {
    availabilityForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      db.settings = {
        startHour: String(fd.get("startHour")),
        endHour: String(fd.get("endHour")),
        slotMinutes: Number(fd.get("slotMinutes")),
        activeDays: qsa("#active-days input:checked").map((x) => Number(x.value)),
        slotPlans: db.settings.slotPlans || {},
      };
      saveDb(db);
      alert("Impostazioni salvate.");
      renderAdminAll(db);
    });
  }

  const courseForm = qs("#course-form");
  if (courseForm) {
    courseForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      db.courses.push({
        id: crypto.randomUUID(),
        name: String(fd.get("name")).trim(),
        duration: Number(fd.get("duration")),
        capacity: Number(fd.get("capacity")),
        mode: String(fd.get("mode")),
      });
      saveDb(db);
      e.target.reset();
      renderAdminAll(db);
    });
  }
}

function setupAdminLogin(db, state) {
  const auth = qs("#admin-auth");
  const area = qs("#admin-area");
  const form = qs("#admin-login-form");
  const logout = qs("#admin-logout");
  if (!auth || !area || !form || !logout) return;

  const refresh = () => {
    if (state.adminLogged) {
      auth.classList.add("hidden");
      area.classList.remove("hidden");
      renderAdminAll(db);
    } else {
      auth.classList.remove("hidden");
      area.classList.add("hidden");
    }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const ok = String(fd.get("username")).trim() === DEFAULT_ADMIN.username && String(fd.get("password")).trim() === DEFAULT_ADMIN.password;
    if (!ok) return alert("Credenziali admin non valide.");
    state.adminLogged = true;
    refresh();
  });

  logout.addEventListener("click", () => {
    state.adminLogged = false;
    refresh();
  });

  refresh();
}
