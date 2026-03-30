import { loadDb } from "./core/store.js";
import { bootClient } from "./features/client.js";
import { bootAdmin } from "./features/admin.js";
import { setupInstallPrompt, setupPwa } from "./pwa/index.js";

const APP_MODE = document.body.dataset.app || "landing";

const state = {
  currentUserId: null,
  adminLogged: false,
  selectedDate: null,
  selectedCourseId: null,
  calendarCursor: new Date(),
  deferredInstallPrompt: null,
};

const db = loadDb();

setupPwa();
setupInstallPrompt(APP_MODE, state);

if (APP_MODE === "client") bootClient(db, state);
if (APP_MODE === "admin") bootAdmin(db, state);
