const STORAGE_KEY = "claudia-perez-pilates-db-v3";

function nextWeekdayFrom(dateStr, weekday) {
  const base = new Date(`${dateStr}T00:00:00`);
  const delta = (weekday - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + delta);
  return base;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ensureRecurringDefaults(db) {
  if (!db.recurringTemplates) db.recurringTemplates = [];
  let defaultCourse = db.courses.find((c) => c.name === "Pilates Ricorrente Test");
  if (!defaultCourse) {
    defaultCourse = {
      id: crypto.randomUUID(),
      name: "Pilates Ricorrente Test",
      duration: 45,
      capacity: 8,
      mode: "group",
    };
    db.courses.push(defaultCourse);
  }

  const hasDefaultTemplate = db.recurringTemplates.some((t) => t.isDefaultTemplate === true);
  if (!hasDefaultTemplate) {
    const today = new Date();
    const start = formatDate(today);
    db.recurringTemplates.push({
      id: crypto.randomUUID(),
      courseId: defaultCourse.id,
      startDate: start,
      weekday: 3,
      time: "14:00",
      intervalWeeks: 1,
      repeatWeeks: 12,
      isDefaultTemplate: true,
      createdAt: new Date().toISOString(),
    });
  }
}

function materializeRecurringTemplates(db) {
  if (!db.settings) return;
  if (!db.settings.slotPlans) db.settings.slotPlans = {};
  db.recurringTemplates.forEach((tpl) => {
    const course = db.courses.find((c) => c.id === tpl.courseId && c.mode === "group");
    if (!course) return;
    const first = nextWeekdayFrom(tpl.startDate, Number(tpl.weekday));
    const interval = Math.max(1, Number(tpl.intervalWeeks || 1));
    const weeks = Math.max(1, Number(tpl.repeatWeeks || 1));
    for (let w = 0; w < weeks; w += interval) {
      const date = new Date(first);
      date.setDate(date.getDate() + w * 7);
      const dateStr = formatDate(date);
      if (!db.settings.slotPlans[dateStr]) db.settings.slotPlans[dateStr] = {};
      const current = db.settings.slotPlans[dateStr][tpl.time] || {};
      db.settings.slotPlans[dateStr][tpl.time] = {
        ...current,
        groupCourseId: current.groupCourseId || course.id,
        recurringTemplateId: tpl.id,
      };
    }
  });
}

function initialDb() {
  const db = {
    users: [],
    courses: [
      { id: crypto.randomUUID(), name: "Pilates Reformer", duration: 45, capacity: 4, mode: "group" },
      { id: crypto.randomUUID(), name: "Pilates Matwork", duration: 45, capacity: 8, mode: "group" },
      { id: crypto.randomUUID(), name: "Personal Pilates", duration: 45, capacity: 1, mode: "personal" },
    ],
    appointments: [],
    settings: {
      startHour: "08:00",
      endHour: "20:00",
      slotMinutes: 45,
      activeDays: [1, 2, 3, 4, 5, 6],
      slotPlans: {},
    },
    recurringTemplates: [],
  };
  ensureRecurringDefaults(db);
  materializeRecurringTemplates(db);
  return db;
}

export function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialDb();
  try {
    const parsed = JSON.parse(raw);
    // Soft migrations (keep existing data)
    if (!parsed.settings) parsed.settings = initialDb().settings;
    if (!parsed.settings.slotPlans) parsed.settings.slotPlans = {};
    if (!parsed.settings.slotMinutes || parsed.settings.slotMinutes === 30) parsed.settings.slotMinutes = 45;
    if (!parsed.courses) parsed.courses = initialDb().courses;
    parsed.courses = parsed.courses.map((course) => ({ ...course, duration: 45 }));
    if (!parsed.users) parsed.users = [];
    if (!parsed.appointments) parsed.appointments = [];
    if (!parsed.recurringTemplates) parsed.recurringTemplates = [];
    ensureRecurringDefaults(parsed);
    materializeRecurringTemplates(parsed);
    return parsed;
  } catch (_err) {
    return initialDb();
  }
}

export function saveDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
