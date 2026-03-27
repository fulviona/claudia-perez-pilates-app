export function bookingBadge(status) {
  return `<span class="badge ${status}">${status}</span>`;
}

export function listItem(contentLeft, contentRight = "") {
  return `<div class="list-item"><div>${contentLeft}</div><div>${contentRight}</div></div>`;
}
