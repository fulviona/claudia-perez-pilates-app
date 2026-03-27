# Claudia Perez Pilates - Booking App (No Install)

Applicazione web demo per gestione prenotazioni clienti e backoffice studio Pilates, realizzata senza dipendenze esterne.

## Caratteristiche implementate

- Registrazione cliente con:
  - nome, cognome, email, cellulare
  - consenso privacy obbligatorio
  - consenso newsletter opzionale
- Login cliente (email + cellulare)
- Calendario mensile con giorni attivi configurabili
- Prenotazione per tipo corso mostrando solo slot disponibili
- Area cliente con elenco prenotazioni e annullo appuntamenti
- Backoffice admin con:
  - gestione utenti registrati e abilitazione prenotazioni
  - calendario con slot liberi/occupati (colori diversi)
  - gestione appuntamenti (stato, annullo, spostamento)
  - configurazione giorni attivi, orari studio, durata slot base
  - gestione corsi (gruppo/personal, durata, capienza)
- Sezione analytics:
  - clienti registrati
  - corsi prenotati, frequentati, no-show, annullati
  - dettaglio metriche per cliente

## Accesso admin (demo)

- Username: `admin`
- Password: `admin123`

## Come eseguirla (senza installare nulla)

1. Apri il file `index.html` con un browser (Chrome, Edge, Firefox).
2. I dati vengono salvati in `localStorage` del browser.

## Note importanti

- Questa versione e una demo locale (frontend-only), quindi:
  - non ha backend reale
  - non ha database condiviso tra dispositivi
  - non invia email/SMS reali
- Per una versione produzione si puo migrare a stack con backend/API e database.

## Pubblicazione su GitHub

1. Crea una nuova repository su GitHub (es. `claudia-perez-pilates-app`).
2. Carica questi file:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. (Opzionale) abilita GitHub Pages per demo online:
   - Settings -> Pages -> Deploy from branch -> `main` / root.
