export function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayString() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatDate(d);
}

export function toMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function addMinutes(timeStr, mins) {
  return minutesToTime(toMinutes(timeStr) + mins);
}

export function monthName(date) {
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}
