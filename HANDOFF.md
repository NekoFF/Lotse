# Übergabe: Stand 13.11.2026 (für die nächste KI / den nächsten Bearbeiter)

## Projekt
Lotse, Schulprojekt (4 Personen, Abgabe Ende Feb 2027). Dima = Projektleitung + gesamte Technik.
Anliegen in Alltagssprache → Sicherheitsfilter (112 / 116117 / 116 123) → Fachrichtung (keine Diagnose!)
→ Praxen nach echter Fahrzeit → Link zur Buchung der Praxis → Kalender mit Losgehzeit → Weg mit Plan B → Begleitung per Link.
Alles kostenlos, kein eigener Server. App = PWA.

## Wo was liegt
- `site/index.html`: Projektseite mit Umfrage, live auf https://nekoff.github.io/Lotse/
- `src/`: App (React 19 + TS + Vite, PWA). Fachlogik in `src/core/` (safety.ts, match.ts, normalize.ts, 12 Tests grün), Daten in `src/data/`.
  Die jetzige App-Oberfläche (`src/screens`, `src/styles.css`) gilt als VERWORFEN (zu sehr iOS-Einstellungen-Look). Fachlogik bleibt.
- `design/entwuerfe/`: NEUE App-Entwürfe (Konzept „Karte als Leinwand“), siehe unten. Original-Canvas: https://claude.ai/artifact/XE9zKzk1AxbQmdugW6HQvx
- `.github/workflows/deploy.yml`: Push auf main → Tests → Build → GitHub Pages.
  `APP_VEROEFFENTLICHEN: "false"` NICHT umstellen, bis Dima es ausdrücklich sagt.

## Stand 13.11.: App nach den Entwürfen neu gebaut (noch nicht veröffentlicht)
- `src/App.tsx` (Zustand, Ansichten start/praxen/weg, Notfall), `src/map/LotseMap.tsx` (MapLibre GL 5 + OpenFreeMap positron/dark, HTML-Pins, Route + Plan B),
  `src/screens/StartPanel|PraxenPanel|WegPanel|Notfall.tsx`, `src/lib/plan.ts` (Losgehzeit, Schritte, .ics, Begleitlink im Hash, gemerkte Termine in localStorage).
- `src/data/geo.ts` GENERIERT: echte Koordinaten (Nominatim) und Wege (routing.openstreetmap.de), Start = Wetzlar Bahnhof. Praxen bleiben erfunden.
- Telefon: Blatt unten; Computer ab 900 px: Seitenleiste links. Hell/Dunkel nach Systemeinstellung.
- Wichtig: `.karte.maplibregl-map` braucht position:absolute (MapLibre-CSS setzt relative). Vor fitBounds `setPadding(0)`, sonst addiert sich der Rand.
- Screenshots in Headless-Chromium nur mit `--use-angle=swiftshader --enable-unsafe-swiftshader`.

## App-Design (Konzept)
Konzept: Die Karte füllt immer den ganzen Bildschirm, alles andere schwebt als Glas darüber.
5 Bildschirme, je Telefon (390×844) und Computer (1280×800), je hell und dunkel:
1. Start: Karte + unten Glasfeld „Was ist los?“ + Beispiel-Chips; oben Chip „nächster Termin + Losgehzeit“.
2. Eingabe: beim Tippen erscheint live „Passt zu: Orthopädie“ + erkannte Wörter (mono) + Button „5 Praxen in der Nähe“ + Ausweg Hausarztpraxis.
3. Praxen: Pins mit Minuten auf der Karte; Liste (Telefon: Sheet unten, PC: Seitenleiste links wie Apple Maps auf dem Mac),
   sortiert nach Fahrzeit, je Karte Mini-Route „zu Fuß 3 › Tram 12 › 2“. PC: Hover auf Karte hebt Pin hervor; ↑↓ ↵ esc.
4. Weg: große Losgehzeit „08:23“ (mono, Akzentfarbe), Schritte mit Uhrzeiten, Plan B gestrichelt, Buttons
   „Bei der Praxis buchen“ (extern), „In Kalender“ (.ics), „Begleitung“ (Link, Daten im URL-Hash).
5. Notfall: roter Schleier über der Karte, „Ruf jetzt die 112.“, ein großer Button, keine Praxissuche.
Tokens: Akzent hell #2447e6 / dunkel #6f8cff; Systemschrift (-apple-system, Inter), Zeiten in Monospace;
Glas = backdrop-filter blur(28px) saturate(1.7). Logo: blaues abgerundetes Quadrat mit Pfeil („Lotse“).
Die `.dc.html`-Dateien sind HTML mit `{{platzhaltern}}` (Design-Canvas-Format), als Vorlage lesbar. `Map.dc.html` = Platzhalter-Stadtkarte.
Echte Karte geplant: MapLibre GL + kostenlose OSM-Kacheln (z. B. OpenFreeMap) – noch nicht geprüft.

## Nächste Schritte
1. Dima nimmt Entwürfe ab / gibt Änderungen.
2. Danach App-Oberfläche in `src/` nach den Entwürfen neu bauen, Fachlogik `src/core` unverändert weiterverwenden, Telefon UND PC.
3. Begriffstabelle auf 200+ erweitern; Routing nach Mischals Bericht (21.11.): db.transport.rest / RMV.
4. Leistungsnachweis pflegen (KI-Nutzung offen angeben).

## Projektseite: letzter Stand
- Handy: neue Story-Ansicht (ganzer Bildschirm steht, oben App-Animation, unten Text des Schritts mit Fortschrittsbalken),
  stabile Höhe gegen Ruckeln (svh + Messung nur bei Breitenänderung), Listen-Hervorhebung blendet weich statt zu flackern.
- Umfrage: Supabase-Projekt `lotse-umfrage` (Tabellen feedback, warteliste; nur Einfügen für anon). service_role-Schlüssel NIE veröffentlichen.
  In `feedback` liegen 2 Testbewertungen (5 Sterne, 30.10., ein Gerät) – vor der Klassenumfrage löschen, wenn Dima zustimmt.

## Regeln von Dima
Ehrliches direktes Feedback; nichts in seinem Namen versenden; bestehende Architektur respektieren; Antworten auf Russisch.
