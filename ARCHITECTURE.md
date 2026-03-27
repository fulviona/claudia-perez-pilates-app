# Refactoring Plan and Execution

## Action Plan

1. Split monolithic logic into feature modules (`client`, `admin`, `pwa`).
2. Centralize shared concerns (`core`, `utils`, `types`, `components`).
3. Keep static hosting compatibility (GitHub Pages, no build step).
4. Update entrypoints and imports to ESM (`type="module"`).
5. Add AI governance rules (`.cursorrules`, `.cursor/rules/*.mdc`).

## Technical Debt Found

- `app.js` was a large monolith (25k+ chars) mixing UI, storage, calendar, and PWA concerns.
- Repeated helper logic (`qs`, tab switching, date utilities).
- Missing type contracts and domain boundaries.
- Tight coupling between page bootstrap and business logic.

## Implemented Changes

- Created `src/` modular structure:
  - `src/main.js`
  - `src/features/{client.js,admin.js}`
  - `src/core/{store.js,calendar.js}`
  - `src/utils/{dom.js,date.js}`
  - `src/components/index.js`
  - `src/types/models.js`
  - `src/api/{bookingApi.js,index.ts}`
  - `src/pwa/index.js`
- Updated `index.html`, `client.html`, `admin.html` to use module entrypoint.
- Removed legacy `app.js`.
- Updated service worker cache list for new module files.
- Added AI rules:
  - `.cursorrules`
  - `.cursor/rules/components.mdc`
  - `.cursor/rules/api.mdc`
