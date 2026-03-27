import { qs } from "../utils/dom.js";

export function setupPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

export function setupInstallPrompt(mode, state) {
  if (mode !== "client") return;
  const banner = qs("#install-banner");
  const installBtn = qs("#install-app-btn");
  const dismissBtn = qs("#dismiss-install-btn");
  if (!banner || !installBtn || !dismissBtn) return;

  const dismissed = localStorage.getItem("install-banner-dismissed") === "1";
  const isStandalone =
    window.matchMedia && window.matchMedia("(display-mode: standalone)").matches
      ? true
      : Boolean(navigator.standalone);

  // Mostriamo comunque il banner su mobile se NON siamo già in modalità standalone.
  // Su iOS Safari l'evento `beforeinstallprompt` non funziona: serve un fallback UI.
  if (dismissed || isStandalone) return;
  banner.classList.remove("hidden");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    installBtn.textContent = "Installa ora";
  });

  installBtn.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) {
      // Fallback: iOS non gestisce `beforeinstallprompt`
      alert("Su iPhone usa Condividi -> Aggiungi a schermata Home.");
      return;
    }
    state.deferredInstallPrompt.prompt();
    try {
      await state.deferredInstallPrompt.userChoice;
    } catch (_err) {
      // noop
    }
    state.deferredInstallPrompt = null;
    banner.classList.add("hidden");
  });

  dismissBtn.addEventListener("click", () => {
    localStorage.setItem("install-banner-dismissed", "1");
    banner.classList.add("hidden");
  });
}
