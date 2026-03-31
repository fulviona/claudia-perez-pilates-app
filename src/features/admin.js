import { WEEK_DAYS, buildBaseSlots, getAppointmentDurationMinutes, getSlotPlan, isDayActive, setSlotPlan } from "../core/calendar.js";
import { formatDate, toMinutes } from "../utils/date.js";
import { qs, qsa } from "../utils/dom.js";
import { saveDb } from "../core/store.js";
import { bookingBadge } from "../components/index.js";

const DEFAULT_ADMIN = { username: "admin", password: "admin123" };
let reliabilityFilter = "all";
const WEEKDAY_LABELS = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];

function nextWeekdayFrom(dateStr, weekday) {
  const base = new Date(`${dateStr}T00:00:00`);
  const delta = (weekday - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + delta);
  return base;
}

function formatDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function applyRecurringTemplateToSlotPlans(db, template) {
  if (!db.settings.slotPlans) db.settings.slotPlans = {};
  const first = nextWeekdayFrom(template.startDate, Number(template.weekday));
  const interval = Math.max(1, Number(template.intervalWeeks || 1));
  const weeks = Math.max(1, Number(template.repeatWeeks || 1));
  for (let w = 0; w < weeks; w += interval) {
    const date = new Date(first);
    date.setDate(date.getDate() + w * 7);
    const dateStr = formatDateOnly(date);
    if (!db.settings.slotPlans[dateStr]) db.settings.slotPlans[dateStr] = {};
    const current = db.settings.slotPlans[dateStr][template.time] || {};
    db.settings.slotPlans[dateStr][template.time] = {
      ...current,
      groupCourseId: current.groupCourseId || template.courseId,
      recurringTemplateId: template.id,
    };
  }
}

function getUserReliabilityMeta(db, userId) {
  const mine = db.appointments.filter((a) => a.userId === userId);
  const completed = mine.filter((a) => a.status === "completed").length;
  const noShow = mine.filter((a) => a.status === "no-show").length;
  const modified = mine.reduce((sum, a) => sum + (a.rescheduledCount || 0), 0);
  const total = mine.length;
  if (total < 5) return { text: "N/D", band: "new" };
  const value = Math.max(0, Math.min(100, Math.round(((completed + modified * 0.2) / (total + noShow * 0.8)) * 100)));
  const band = value >= 80 ? "high" : value >= 50 ? "medium" : "low";
  return { text: `${value}%`, band };
}

export function bootAdmin(db, state) {
  setupAdminTabs();
  setupAttendeesModal();
  setupAdminEvents(db);
  setupAdminLogin(db, state);
}

function autoUpdateAttendance(db) {
  const now = new Date();
  let changed = false;
  db.appointments.forEach((a) => {
    if (a.status !== "booked") return;
    const start = new Date(`${a.date}T${a.startTime}:00`);
    const graceLimit = new Date(start.getTime() + 30 * 60 * 1000);
    if (now >= graceLimit) {
      a.status = "completed";
      changed = true;
    }
  });
  if (changed) saveDb(db);
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
      (u) => {
        const reliability = getUserReliabilityMeta(db, u.id);
        return `<div class="list-item">
        <div><b>${u.firstName} ${u.lastName}</b> <span class="reliability-dot ${reliability.band}" title="Affidabilita ${reliability.text}"></span> - ${u.email} - ${u.phone}<br/>Privacy: ${u.privacyConsent ? "si" : "no"} | Newsletter: ${u.newsletterConsent ? "si" : "no"}</div>
        <button data-approve="${u.id}">${u.approved ? "Disabilita prenotazioni" : "Abilita prenotazioni"}</button>
      </div>`;
      }
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
  const now = new Date();
  const slotSize = db.settings.slotMinutes;
  const overlapsSlot = (slotStart, apptStart, apptDuration) => {
    const aS = toMinutes(slotStart);
    const aE = aS + slotSize;
    const bS = toMinutes(apptStart);
    const bE = bS + apptDuration;
    return aS < bE && bS < aE;
  };

  slotsBox.innerHTML = baseSlots
    .map((s) => {
      const plan = getSlotPlan(db, date, s);
      const isBlocked = Boolean(plan?.blocked);
      const overlappingBookings = db.appointments.filter((a) => {
        if (a.date !== date || a.status === "cancelled") return false;
        const duration = getAppointmentDurationMinutes(db, a);
        return overlapsSlot(s, a.startTime, duration);
      });
      const hasBooking = overlappingBookings.length > 0;
      const hasConfirmed = overlappingBookings.some((a) => a.status !== "booked");
      const hasStarted = overlappingBookings.some((a) => {
        const start = new Date(`${a.date}T${a.startTime}:00`);
        return now >= start;
      });
      const hasBookedPending = overlappingBookings.some((a) => a.status === "booked");

      let statusText = "Libero";
      let statusClass = "slot-status free";
      if (isBlocked || hasConfirmed || hasStarted) {
        statusText = "Confermato";
        statusClass = "slot-status busy";
      } else if (hasBooking && hasBookedPending) {
        statusText = "Prenotato";
        statusClass = "slot-status planned";
      }

      const groupCourseId = plan?.groupCourseId || "";
      const blockPersonal = Boolean(plan?.blockPersonal);
      const plannedCourse = db.courses.find((c) => c.id === groupCourseId);
      const groupOptions =
        `<option value="">— nessun corso gruppo —</option>` +
        groupCourses.map((c) => `<option ${c.id === groupCourseId ? "selected" : ""} value="${c.id}">${c.name}</option>`).join("");
      const plannedText = plannedCourse ? `<div class="slot-meta">Sessione: ${plannedCourse.name}</div>` : "";
      const slotBookings = db.appointments.filter((a) => a.date === date && a.startTime === s && a.status !== "cancelled");
      const attendeesCount = slotBookings.length;

      return `<div class="slot-box ${statusClass.includes("busy") ? "slot-busy" : statusClass.includes("planned") ? "slot-planned" : "slot-free"}">
        <div class="slot-header-row"><b>${s}</b><span class="${statusClass}">${statusText}</span></div>
        ${plannedText}
        <div class="slot-controls">
          <label class="slot-control">
            Corso gruppo
            <select data-plan-group="${s}">${groupOptions}</select>
          </label>
          <label class="slot-check-control">
            <input type="checkbox" data-plan-block-personal="${s}" ${blockPersonal ? "checked" : ""} />
            <span>Blocca personal</span>
          </label>
          <button class="btn-secondary" data-plan-toggle-block="${s}">${isBlocked ? "Sblocca slot" : "Blocca slot"}</button>
          <button class="btn-secondary" data-slot-attendees="${s}" type="button">Prenotati (${attendeesCount})</button>
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

  qsa("[data-slot-attendees]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openAttendeesModal(db, date, btn.dataset.slotAttendees);
    });
  });
}

function setupAttendeesModal() {
  const closeBtn = qs("#close-attendees-modal");
  const backdrop = qs('[data-close-modal="attendees"]');
  if (closeBtn) closeBtn.addEventListener("click", closeAttendeesModal);
  if (backdrop) backdrop.addEventListener("click", closeAttendeesModal);
}

function closeAttendeesModal() {
  const modal = qs("#attendees-modal");
  if (!modal) return;
  modal.classList.add("hidden");
}

function openAttendeesModal(db, date, time) {
  const modal = qs("#attendees-modal");
  const title = qs("#attendees-modal-title");
  const list = qs("#attendees-list");
  const detail = qs("#attendee-detail");
  if (!modal || !title || !list || !detail) return;

  title.textContent = `Prenotati ${date} ${time}`;
  const bookings = db.appointments
    .filter((a) => a.date === date && a.startTime === time && a.status !== "cancelled")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const plan = getSlotPlan(db, date, time);
  const slotCourseId = plan?.groupCourseId || bookings[0]?.courseId || null;
  const slotCourse = slotCourseId ? db.courses.find((c) => c.id === slotCourseId) : null;
  const isGroupSlot = slotCourse?.mode === "group";
  const bookedForSlotCourse = slotCourse
    ? bookings.filter((a) => a.courseId === slotCourse.id).length
    : bookings.length;
  const remainingSeats = isGroupSlot ? Math.max(0, slotCourse.capacity - bookedForSlotCourse) : 0;
  const bookedUserIds = new Set(bookings.map((b) => b.userId));
  const eligibleUsers = db.users.filter((u) => !bookedUserIds.has(u.id));

  const slotInfo = slotCourse
    ? `<p><b>Corso:</b> ${slotCourse.name}</p>`
    : "<p><b>Corso:</b> non definito per questo slot.</p>";
  const seatInfo = isGroupSlot
    ? `<p><b>Posti:</b> ${bookedForSlotCourse}/${slotCourse.capacity} prenotati - disponibili: ${remainingSeats}</p>`
    : "";
  const manualAddForm = isGroupSlot
    ? `
      <div class="attendee-detail">
        <p><b>Aggiungi utente a questo corso</b></p>
        ${
          remainingSeats > 0
            ? `<label>Seleziona utente
                <select id="attendees-add-user">
                  <option value="">-- scegli utente --</option>
                  ${eligibleUsers.map((u) => `<option value="${u.id}">${u.firstName} ${u.lastName} - ${u.email}</option>`).join("")}
                </select>
              </label>
              <button class="btn-secondary" id="attendees-add-user-btn" type="button">Aggiungi prenotazione</button>`
            : "<p>Capienza raggiunta: non ci sono posti liberi.</p>"
        }
      </div>
    `
    : "";

  list.innerHTML = `${slotInfo}${seatInfo}${manualAddForm}${bookings.length ? "" : "<p>Nessun prenotato su questo slot.</p>"}`;

  if (bookings.length) {
    list.innerHTML += bookings
      .map((b) => {
        const user = db.users.find((u) => u.id === b.userId);
        const label = user ? `${user.firstName} ${user.lastName}` : "Utente sconosciuto";
        const reliability = user ? getUserReliabilityMeta(db, user.id) : { text: "N/D", band: "new" };
        return `<button class="attendee-item" type="button" data-attendee-user="${b.userId}" data-attendee-booking="${b.id}">${label} <span class="reliability-dot ${reliability.band}" title="Affidabilita ${reliability.text}"></span></button>`;
      })
      .join("");
  }

  qsa("[data-attendee-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = db.users.find((u) => u.id === btn.dataset.attendeeUser);
      const booking = db.appointments.find((a) => a.id === btn.dataset.attendeeBooking);
      const course = db.courses.find((c) => c.id === booking?.courseId);
      if (!user) {
        detail.innerHTML = "<p>Dati cliente non disponibili.</p>";
        return;
      }
      detail.innerHTML = `
        <p><b>${user.firstName} ${user.lastName}</b></p>
        <p>Email: ${user.email}</p>
        <p>Telefono: <a href="tel:${user.phone}">${user.phone}</a></p>
        <p>Corso: ${course?.name || "-"}</p>
        <p>Stato: ${booking?.status || "-"}</p>
      `;
    });
  });

  const addBtn = qs("#attendees-add-user-btn");
  const addUserSelect = qs("#attendees-add-user");
  if (addBtn && addUserSelect && isGroupSlot) {
    addBtn.addEventListener("click", () => {
      const userId = addUserSelect.value;
      if (!userId) return alert("Seleziona un utente.");
      if (!slotCourse) return alert("Corso non valido per questo slot.");
      const alreadyBooked = db.appointments.some(
        (a) => a.userId === userId && a.date === date && a.startTime === time && a.status !== "cancelled"
      );
      if (alreadyBooked) return alert("Utente gia prenotato su questo slot.");
      const currentCount = db.appointments.filter(
        (a) => a.date === date && a.startTime === time && a.courseId === slotCourse.id && a.status !== "cancelled"
      ).length;
      if (currentCount >= slotCourse.capacity) return alert("Capienza raggiunta.");

      db.appointments.push({
        id: crypto.randomUUID(),
        userId,
        courseId: slotCourse.id,
        date,
        startTime: time,
        status: "booked",
        createdAt: new Date().toISOString(),
      });
      saveDb(db);
      renderAdminSlots(db);
      renderAdminBookings(db);
      openAttendeesModal(db, date, time);
    });
  }

  const firstUserBtn = qs("[data-attendee-user]");
  if (firstUserBtn) firstUserBtn.click();
  else detail.innerHTML = "<p>Seleziona un nome per vedere i dettagli.</p>";
  modal.classList.remove("hidden");
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
          const reliability = user ? getUserReliabilityMeta(db, user.id) : { text: "N/D", band: "new" };
          return `<div class="list-item">
            <div><b>${a.date} ${a.startTime}</b> - ${course?.name || "Corso rimosso"} - ${user?.firstName || "?"} ${user?.lastName || ""} <span class="reliability-dot ${reliability.band}" title="Affidabilita ${reliability.text}"></span> ${bookingBadge(a.status)}</div>
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
      const nextDate = qs(`[data-move-date="${id}"]`).value;
      const nextTime = qs(`[data-move-time="${id}"]`).value;
      const changed = appt.date !== nextDate || appt.startTime !== nextTime;
      appt.date = nextDate;
      appt.startTime = nextTime;
      if (changed) appt.rescheduledCount = (appt.rescheduledCount || 0) + 1;
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
  const recurringSelect = qs("#recurring-course-select");
  if (!box) return;
  box.innerHTML = db.courses
    .map(
      (c) => `<div class="list-item"><div><b>${c.name}</b> - ${c.mode} - ${c.duration} min - capienza ${c.capacity}</div><div><button class="btn-secondary" data-edit-course="${c.id}">Modifica</button> <button data-delete-course="${c.id}">Elimina</button></div></div>`
    )
    .join("");
  qsa("[data-edit-course]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const course = db.courses.find((c) => c.id === btn.dataset.editCourse);
      if (!course) return;
      const nextName = prompt("Nome corso:", course.name);
      if (nextName === null) return;
      const nextDurationRaw = prompt("Durata (minuti):", String(course.duration));
      if (nextDurationRaw === null) return;
      const nextCapacityRaw = prompt("Capienza:", String(course.capacity));
      if (nextCapacityRaw === null) return;
      const nextModeRaw = prompt("Tipo corso (group/personal):", course.mode);
      if (nextModeRaw === null) return;

      const nextDuration = Number(nextDurationRaw);
      const nextCapacity = Number(nextCapacityRaw);
      const nextMode = String(nextModeRaw).trim().toLowerCase();
      if (!String(nextName).trim() || Number.isNaN(nextDuration) || nextDuration < 15) return alert("Durata non valida.");
      if (Number.isNaN(nextCapacity) || nextCapacity < 1) return alert("Capienza non valida.");
      if (!["group", "personal"].includes(nextMode)) return alert("Tipo corso non valido. Usa group o personal.");

      course.name = String(nextName).trim();
      course.duration = nextDuration;
      course.capacity = nextCapacity;
      course.mode = nextMode;
      saveDb(db);
      renderAdminAll(db);
    });
  });
  qsa("[data-delete-course]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hasBooking = db.appointments.some((a) => a.courseId === btn.dataset.deleteCourse && a.status !== "cancelled");
      if (hasBooking) return alert("Non puoi eliminare un corso con appuntamenti attivi.");
      db.courses = db.courses.filter((c) => c.id !== btn.dataset.deleteCourse);
      saveDb(db);
      renderAdminAll(db);
    });
  });

  if (recurringSelect) {
    recurringSelect.innerHTML = db.courses
      .filter((c) => c.mode === "group")
      .map((c) => `<option value="${c.id}">${c.name} (${c.capacity} posti)</option>`)
      .join("");
  }
}

function renderRecurringTemplates(db) {
  const list = qs("#recurring-list");
  if (!list) return;
  const templates = db.recurringTemplates || [];
  if (!templates.length) {
    list.innerHTML = "<p>Nessuna ricorrenza configurata.</p>";
    return;
  }
  list.innerHTML = templates
    .map((t) => {
      const course = db.courses.find((c) => c.id === t.courseId);
      const intervalTxt = Number(t.intervalWeeks) === 2 ? "ogni 2 settimane" : "ogni settimana";
      return `<div class="list-item">
        <div><b>${course?.name || "Corso rimosso"}</b> - ${WEEKDAY_LABELS[Number(t.weekday)]} ore ${t.time} - da ${t.startDate} - ${intervalTxt} - ${t.repeatWeeks} settimane</div>
        <button data-delete-recurring="${t.id}">Elimina ricorrenza</button>
      </div>`;
    })
    .join("");

  qsa("[data-delete-recurring]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteRecurring;
      db.recurringTemplates = (db.recurringTemplates || []).filter((t) => t.id !== id);
      Object.keys(db.settings.slotPlans || {}).forEach((date) => {
        Object.keys(db.settings.slotPlans[date] || {}).forEach((time) => {
          const plan = db.settings.slotPlans[date][time];
          if (plan?.recurringTemplateId === id) {
            delete db.settings.slotPlans[date][time];
          }
        });
      });
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
  const userMetrics = db.users.map((u) => {
    const mine = db.appointments.filter((a) => a.userId === u.id);
    const booked = mine.filter((a) => a.status === "booked").length;
    const completed = mine.filter((a) => a.status === "completed").length;
    const cancelled = mine.filter((a) => a.status === "cancelled").length;
    const noShow = mine.filter((a) => a.status === "no-show").length;
    const modified = mine.reduce((sum, a) => sum + (a.rescheduledCount || 0), 0);
    const total = mine.length;

    const reliability = getUserReliabilityMeta(db, u.id);
    return {
      user: u,
      total,
      booked,
      completed,
      cancelled,
      noShow,
      modified,
      reliabilityText: reliability.text,
      reliabilityBand: reliability.band,
    };
  });

  const filtersHtml = `
    <div class="reliability-filters">
      <button type="button" class="btn-secondary ${reliabilityFilter === "all" ? "active" : ""}" data-reliability-filter="all">Tutti</button>
      <button type="button" class="btn-secondary ${reliabilityFilter === "high" ? "active" : ""}" data-reliability-filter="high">Alta affidabilita</button>
      <button type="button" class="btn-secondary ${reliabilityFilter === "medium" ? "active" : ""}" data-reliability-filter="medium">Media affidabilita</button>
      <button type="button" class="btn-secondary ${reliabilityFilter === "low" ? "active" : ""}" data-reliability-filter="low">Bassa affidabilita</button>
      <button type="button" class="btn-secondary ${reliabilityFilter === "new" ? "active" : ""}" data-reliability-filter="new">Nuovo</button>
    </div>
  `;

  const filtered = reliabilityFilter === "all" ? userMetrics : userMetrics.filter((m) => m.reliabilityBand === reliabilityFilter);

  const listHtml =
    filtered
      .map((m) => {
        return `<div class="list-item">
          <div><b>${m.user.firstName} ${m.user.lastName}</b> - ${m.user.email}<br/>Prenotazioni: ${m.total} | Presenti: ${m.completed} | Modificate: ${m.modified} | Annullate: ${m.cancelled} | No-show: ${m.noShow} | In attesa: ${m.booked}</div>
          <div><span class="reliability-badge ${m.reliabilityBand}">Affidabilita: ${m.reliabilityText}</span></div>
        </div>`;
      })
      .join("") || "<p>Nessun dato disponibile per questo filtro.</p>";

  usersBox.innerHTML = filtersHtml + listHtml;

  qsa("[data-reliability-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      reliabilityFilter = btn.dataset.reliabilityFilter;
      renderAnalytics(db);
    });
  });
}

function renderAdminAll(db) {
  autoUpdateAttendance(db);
  renderUsersTable(db);
  renderAdminSlots(db);
  renderAdminBookings(db);
  renderSettingsForm(db);
  renderCourses(db);
  renderRecurringTemplates(db);
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

  const recurringForm = qs("#recurring-form");
  if (recurringForm) {
    if (recurringForm.startDate && !recurringForm.startDate.value) recurringForm.startDate.value = formatDate(new Date());
    recurringForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const template = {
        id: crypto.randomUUID(),
        courseId: String(fd.get("courseId")),
        startDate: String(fd.get("startDate")),
        weekday: Number(fd.get("weekday")),
        time: String(fd.get("time")),
        intervalWeeks: Number(fd.get("intervalWeeks")),
        repeatWeeks: Number(fd.get("repeatWeeks")),
        createdAt: new Date().toISOString(),
      };
      const course = db.courses.find((c) => c.id === template.courseId);
      if (!course || course.mode !== "group") return alert("Seleziona un corso di gruppo valido.");
      if (!template.startDate || !template.time) return alert("Data e ora sono obbligatorie.");
      if (template.repeatWeeks < 1) return alert("Numero settimane non valido.");
      if (!db.recurringTemplates) db.recurringTemplates = [];
      db.recurringTemplates.push(template);
      applyRecurringTemplateToSlotPlans(db, template);
      saveDb(db);
      recurringForm.reset();
      if (recurringForm.startDate) recurringForm.startDate.value = formatDate(new Date());
      renderAdminAll(db);
    });
  }

  const manualUserForm = qs("#manual-user-form");
  if (manualUserForm) {
    manualUserForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = String(fd.get("email")).trim().toLowerCase();
      if (db.users.some((u) => u.email.toLowerCase() === email)) {
        alert("Esiste gia un cliente con questa email.");
        return;
      }
      db.users.push({
        id: crypto.randomUUID(),
        firstName: String(fd.get("firstName")).trim(),
        lastName: String(fd.get("lastName")).trim(),
        email,
        phone: String(fd.get("phone")).trim(),
        password: String(fd.get("password")).trim(),
        privacyConsent: true,
        newsletterConsent: false,
        approved: fd.get("approved") === "on",
        createdAt: new Date().toISOString(),
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

  setInterval(() => {
    if (!state.adminLogged) return;
    renderAdminAll(db);
  }, 60 * 1000);

  refresh();
}
