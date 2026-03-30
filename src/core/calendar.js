import { addMinutes, toMinutes, todayString } from "../utils/date.js";

export const WEEK_DAYS = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mer" },
  { id: 4, label: "Gio" },
  { id: 5, label: "Ven" },
  { id: 6, label: "Sab" },
];

export function isDayActive(db, dateStr) {
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return db.settings.activeDays.includes(day);
}

export function isFutureOrToday(dateStr) {
  return dateStr >= todayString();
}

export function canBookDate(db, dateStr) {
  return isDayActive(db, dateStr) && isFutureOrToday(dateStr);
}

export function getSlotPlan(db, dateStr, timeStr) {
  return db.settings?.slotPlans?.[dateStr]?.[timeStr] || null;
}

export function setSlotPlan(db, dateStr, timeStr, plan) {
  if (!db.settings.slotPlans) db.settings.slotPlans = {};
  if (!db.settings.slotPlans[dateStr]) db.settings.slotPlans[dateStr] = {};
  if (!plan) {
    delete db.settings.slotPlans[dateStr][timeStr];
    return;
  }
  db.settings.slotPlans[dateStr][timeStr] = plan;
}

function bookingOverlaps(aStart, aDuration, bStart, bDuration) {
  const aS = toMinutes(aStart);
  const aE = aS + aDuration;
  const bS = toMinutes(bStart);
  const bE = bS + bDuration;
  return aS < bE && bS < aE;
}

function activeBookingsOnDate(db, dateStr) {
  return db.appointments.filter((a) => a.date === dateStr && a.status !== "cancelled");
}

function getPlannedSessionsOnDate(db, dateStr) {
  const plansForDate = db.settings?.slotPlans?.[dateStr] || {};
  return Object.entries(plansForDate)
    .map(([startTime, plan]) => {
      if (!plan || !plan.groupCourseId || plan.blocked) return null;
      const course = db.courses.find((c) => c.id === plan.groupCourseId);
      if (!course) return null;
      return { startTime, duration: course.duration, courseId: course.id };
    })
    .filter(Boolean);
}

export function buildBaseSlots(db) {
  const slots = [];
  let current = db.settings.startHour;
  const endMins = toMinutes(db.settings.endHour);
  while (toMinutes(current) < endMins) {
    slots.push(current);
    current = addMinutes(current, db.settings.slotMinutes);
  }
  return slots;
}

function buildSlotsForCourse(db, dateStr, course) {
  if (!canBookDate(db, dateStr)) return [];
  const slots = [];
  let current = db.settings.startHour;
  const endMins = toMinutes(db.settings.endHour);
  while (toMinutes(current) + course.duration <= endMins) {
    slots.push(current);
    current = addMinutes(current, db.settings.slotMinutes);
  }
  return slots;
}

function slotHasOtherCourseBooking(db, dateStr, timeStr, courseId) {
  return db.appointments.some((a) => a.date === dateStr && a.startTime === timeStr && a.status !== "cancelled" && a.courseId !== courseId);
}

function countBookingsForCourseAtSlot(db, dateStr, timeStr, courseId) {
  return db.appointments.filter((a) => a.date === dateStr && a.startTime === timeStr && a.status !== "cancelled" && a.courseId === courseId).length;
}

function countAnyBookingsAtSlot(db, dateStr, timeStr) {
  return db.appointments.filter((a) => a.date === dateStr && a.startTime === timeStr && a.status !== "cancelled").length;
}

export function getAppointmentDurationMinutes(db, appointment) {
  const course = db.courses.find((c) => c.id === appointment.courseId);
  if (!course) return db.settings.slotMinutes;
  // Regola: personal sempre 60 minuti
  if (course.mode === "personal") return 60;
  return course.duration;
}

export function slotIsOccupied(db, dateStr, slotTime) {
  const plan = getSlotPlan(db, dateStr, slotTime);
  if (plan?.blocked) return true;
  const slotMins = db.settings.slotMinutes;
  const dayBookings = activeBookingsOnDate(db, dateStr);
  const bookingOccupies = dayBookings.some((b) => {
    const bDur = getAppointmentDurationMinutes(db, b);
    return bookingOverlaps(slotTime, slotMins, b.startTime, bDur);
  });
  if (bookingOccupies) return true;

  const plannedSessions = getPlannedSessionsOnDate(db, dateStr);
  return plannedSessions.some((s) => bookingOverlaps(slotTime, slotMins, s.startTime, s.duration));
}

function hasAnyOverlap(db, dateStr, startTime, durationMins) {
  const dayBookings = activeBookingsOnDate(db, dateStr);
  const bookingsOverlap = dayBookings.some((b) => {
    const bDur = getAppointmentDurationMinutes(db, b);
    return bookingOverlaps(startTime, durationMins, b.startTime, bDur);
  });
  if (bookingsOverlap) return true;

  const plannedSessions = getPlannedSessionsOnDate(db, dateStr);
  return plannedSessions.some((s) => bookingOverlaps(startTime, durationMins, s.startTime, s.duration));
}

export function availableSlots(db, dateStr, courseId) {
  const course = db.courses.find((c) => c.id === courseId);
  if (!course) return [];
  const dayBookings = activeBookingsOnDate(db, dateStr);

  // Regola: personal sempre 60 minuti (prenotabili in autonomia, se non bloccati e senza overlap)
  if (course.mode === "personal") {
    const duration = 60;
    return buildSlotsForCourse(db, dateStr, { ...course, duration }).flatMap((slotTime) => {
      const plan = getSlotPlan(db, dateStr, slotTime);
      if (plan?.blocked) return [];
      if (plan?.blockPersonal) return [];
      if (plan?.groupCourseId) return [];
      // vieta se esiste qualsiasi overlap (es. gruppo 8-9 occupa anche 8:30)
      if (hasAnyOverlap(db, dateStr, slotTime, duration)) return [];
      return [{ time: slotTime, remaining: 1, capacity: 1 }];
    });
  }

  // Regola: gruppo SOLO su sessioni programmate dall'admin (slotPlans[date][time].groupCourseId).
  // Cliente non "crea" nuove sessioni; può solo unirsi se posti liberi.
  return buildBaseSlots(db).flatMap((slotTime) => {
    if (!canBookDate(db, dateStr)) return [];
    const plan = getSlotPlan(db, dateStr, slotTime);
    if (!plan?.groupCourseId) return [];
    if (plan.groupCourseId !== courseId) return [];
    if (plan.blocked) return [];

    // Se esistono prenotazioni di un altro corso nello stesso slot, non consentire mix.
    if (slotHasOtherCourseBooking(db, dateStr, slotTime, courseId)) return [];

    // Se c'è un booking che collide ma NON è la stessa sessione (stesso corso+stesso startTime) => non disponibile
    const overlappingBookings = dayBookings.filter((b) => {
      const bDur = getAppointmentDurationMinutes(db, b);
      return bookingOverlaps(slotTime, course.duration, b.startTime, bDur);
    });
    const invalidBookingOverlap = overlappingBookings.some((b) => b.courseId !== courseId || b.startTime !== slotTime);
    if (invalidBookingOverlap) return [];

    const plannedSessions = getPlannedSessionsOnDate(db, dateStr);
    const invalidPlannedOverlap = plannedSessions.some((s) => {
      if (!bookingOverlaps(slotTime, course.duration, s.startTime, s.duration)) return false;
      return !(s.courseId === courseId && s.startTime === slotTime);
    });
    if (invalidPlannedOverlap) return [];

    const bookedCount = countBookingsForCourseAtSlot(db, dateStr, slotTime, courseId);
    const remaining = Math.max(0, course.capacity - bookedCount);
    if (remaining <= 0) return [];
    return [{ time: slotTime, remaining, capacity: course.capacity }];
  });
}
