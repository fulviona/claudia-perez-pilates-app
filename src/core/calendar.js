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

export function availableSlots(db, dateStr, courseId) {
  const course = db.courses.find((c) => c.id === courseId);
  if (!course) return [];
  const dayBookings = activeBookingsOnDate(db, dateStr);
  return buildSlotsForCourse(db, dateStr, course).filter((slotTime) => {
    const overlapping = dayBookings.filter((b) => {
      const bCourse = db.courses.find((c) => c.id === b.courseId);
      if (!bCourse) return false;
      return bookingOverlaps(slotTime, course.duration, b.startTime, bCourse.duration);
    });
    return overlapping.length < course.capacity;
  });
}
