const STORAGE_KEY = "claudia-perez-pilates-db-v3";

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
      slotPlans: {},
    },
  };
}

export function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialDb();
  try {
    const parsed = JSON.parse(raw);
    // Soft migrations (keep existing data)
    if (!parsed.settings) parsed.settings = initialDb().settings;
    if (!parsed.settings.slotPlans) parsed.settings.slotPlans = {};
    if (!parsed.courses) parsed.courses = initialDb().courses;
    if (!parsed.users) parsed.users = [];
    if (!parsed.appointments) parsed.appointments = [];
    return parsed;
  } catch (_err) {
    return initialDb();
  }
}

export function saveDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
