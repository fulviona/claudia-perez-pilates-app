export function qs(sel) {
  return document.querySelector(sel);
}

export function qsa(sel) {
  return [...document.querySelectorAll(sel)];
}

export function openTabById(tabId) {
  qsa(".tab-btn").forEach((x) => x.classList.remove("active"));
  qsa(".tab-content").forEach((x) => x.classList.remove("active"));
  const tab = qs(`#${tabId}`);
  if (tab) tab.classList.add("active");
}

export function setupTabs() {
  qsa(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      qsa(".tab-btn").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      qsa(".tab-content").forEach((x) => x.classList.remove("active"));
      qs(`#${btn.dataset.tab}-tab`).classList.add("active");
    });
  });
}
