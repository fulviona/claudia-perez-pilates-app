# Claudia Perez Pilates - Booking App (No Install)

Applicazione web (frontend-only) pronta per GitHub Pages, senza installazioni locali.

## Accessi separati

- Home accessi: `index.html`
- Area clienti (link dedicato): `client.html`
- Backoffice admin (link dedicato): `admin.html`

## Funzionalita principali

- Registrazione cliente con:
  - nome, cognome, email, cellulare
  - password scelta dal cliente
  - consenso privacy obbligatorio
  - consenso newsletter opzionale
- Login cliente con email + password
- Calendario prenotazioni: selezione consentita solo su giorni disponibili da oggi in poi
- Visualizzazione slot in base a disponibilita reale
- Backoffice admin:
  - abilitazione/disabilitazione utenti
  - calendario con slot liberi/occupati
  - gestione appuntamenti (stato, annullo, spostamento)
  - configurazione giorni attivi, orari e slot
  - gestione corsi (durata, capienza, gruppo/personal)
- Analytics base:
  - clienti registrati
  - prenotati, presenti, no-show, annullati
  - dettaglio per cliente

## PWA / WebApp mobile

- `manifest.webmanifest` e `service-worker.js` inclusi
- installabile su home del cellulare da browser compatibili (Chrome/Edge/Samsung Internet)
- icona app: `icon.svg`

## Struttura progetto (refactor)

- `src/main.js` bootstrap applicazione
- `src/features/` logica separata cliente/admin
- `src/core/` storage e regole calendario
- `src/utils/` helper DOM/date
- `src/components/` frammenti UI riusabili
- `src/types/` contratti JSDoc / tipi
- `src/api/` adapter API demo e punto estensione TypeScript
- `src/pwa/` install prompt e service worker setup

Dettagli refactor: `ARCHITECTURE.md`

## Credenziali admin demo

- Username: `admin`
- Password: `admin123`

## Pubblicazione GitHub Pages

1. Carica tutti i file della repository.
2. Vai in `Settings -> Pages`.
3. Seleziona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/(root)`
4. Salva e attendi il deploy.

## Footer richiesto

In tutte le pagine e presente:

`Versione 2.2.0 - Powered by FulvioNa`
