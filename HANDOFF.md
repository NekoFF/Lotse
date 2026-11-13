# Übergabe – Stand 13.11.2026 (für den nächsten Chat / die nächste KI)

Lies diese Datei komplett, bevor du etwas änderst. Antworte Dima auf Russisch.

## 1. Projekt in drei Sätzen
Lotse ist ein Schulprojekt (Werner-von-Siemens-Schule Wetzlar, 4 Personen, Abgabe/Präsentation Ende Feb 2027, zählt als Prüfung, wird gefilmt, Ziel Note 1).
Ablauf: Anliegen in Alltagssprache → Sicherheitsfilter (112 / 116 117 / Telefonseelsorge) → Fachrichtung (NIE eine Diagnose, sonst Medizinprodukt nach MDR) → echte Praxen in der Nähe nach echter Fahrzeit → Kontakt/Buchung bei der Praxis → Kalender mit Losgehzeit → Weg mit Plan B → Begleitung per Link.
Team: Dima (Projektleitung, macht ALLE Technik mit KI), Michal (Datenquellen/ÖPNV-Recherche, Bericht 21.11.), Abdi (Nutzersicht, Umfrage), Fateme (Dokumentation).

## 2. Regeln von Dima (verbindlich)
- **Nichts erfinden.** Jede Zahl hat eine Quelle. Fehlt sie oder fällt ein Dienst aus, zeigt die App das ehrlich an („nicht verfügbar“, „unbekannt“) statt zu schätzen. Keine Fake-Praxen, keine geschätzten Buszeiten.
- **Live statt lokal.** Daten werden zur Laufzeit online geladen, für jeden Ort der Welt. Lokale Daten nur für Tests.
- **Jetzt kostenlos, später kaufbar.** Alle Dienste stehen in `src/config.ts`; für den Echtbetrieb werden dort nur Adressen getauscht (Tabelle in der Datei).
- **App NICHT veröffentlichen**, bis Dima es sagt (`APP_VEROEFFENTLICHEN: "false"` in `.github/workflows/deploy.yml`). Dima will lokal testen (`npm run dev`).
- Design: Apple-Niveau mit eigener Note. Ehrliches, direktes Feedback. Nichts in seinem Namen versenden. Russisch nicht korrigieren.
- Supabase-`service_role`-Schlüssel nie veröffentlichen.

## 3. Wo was liegt
| Was | Wo |
| --- | --- |
| Code, Projektseite, Entwürfe, diese Datei | GitHub `NekoFF/Lotse` (`main` = lauffähig; `arbeit/echte-daten` = laufende Umstellung auf Live-Daten) |
| Projektseite mit Umfrage (live) | https://nekoff.github.io/Lotse/ (`site/index.html`) |
| App-Entwürfe | `design/entwuerfe/` und Claude-Canvas „Lotse App Design“ |
| Private Vorschau der App | Claude-Artefakt „Lotse App“ (Karte evtl. blockiert, Downloads gehen dort nicht) |
| Konzept, Leistungsnachweis | Claude Docs „Lotse – Projektkonzept“, „Lotse – Leistungsnachweis“ (Name Michal dort noch falsch „Mischal“ – korrigieren) |
| Umfrage-Daten | Supabase-Projekt `lotse-umfrage` (Tabellen `feedback`, `warteliste`; anon darf nur einfügen) |
| Kooperationsvertrag (Entwurf) | `dokumente/Kooperationsvereinbarung_Entwurf.md` |

## 4. Technik
React 19 + TypeScript + Vite 6, PWA (vite-plugin-pwa), MapLibre GL 5, Tests mit vitest, Deploy über GitHub Actions → Pages.
- `src/core/` Fachlogik: `safety.ts` (Sicherheitsfilter, läuft IMMER zuerst), `match.ts` (Zuordnung), `normalize.ts`, `osmFach.ts` (Fachrichtung aus OSM-Tags/Namen, sonst null) – unverändert lassen, nur erweitern, Tests in `core.test.ts`.
- `src/data/` Begriffstabelle, Notfallbegriffe, Fachrichtungen, Typen (`praxen.ts`).
- `src/config.ts` alle Dienste. `src/services/dienste.ts`: Standort (GPS/Adresse über Nominatim), Praxissuche (Nominatim `[doctors]`/`[dentist]` im Umkreis, extratags), Fahrzeiten (OSRM `table` je Modus fuss/rad/auto, eine Anfrage), Wegeslinie (OSRM `route`), Fehlertexte für die Oberfläche.
- `src/lib/plan.ts` Losgehzeit (Termin − 10 Min Puffer − echte Fahrzeit), Plan B = zweitschnellster echter Modus, `.ics`, Begleitlink im URL-Hash (kein Server), gemerkte Termine in localStorage.
- `src/map/LotseMap.tsx` Vollbildkarte, HTML-Pins, Route + Plan B gestrichelt. Achtung: `.karte.maplibregl-map` braucht `position:absolute`; vor `fitBounds` `setPadding(0)`.
- `src/screens/` StartPanel, PraxenPanel, WegPanel, Notfall. Telefon = Glasblatt unten, Computer ≥ 900 px = Seitenleiste links, hell/dunkel nach System, Tasten `/ ↑ ↓ ↵ esc`.
- `scripts/daten_laden.py` lädt echte Praxen + Wege für Tests (`scripts/beispieldaten/`).
- Screenshots in Headless-Chromium nur mit `--use-angle=swiftshader --enable-unsafe-swiftshader`.

## 5. Umstellung auf Live-Daten – ERLEDIGT am 13.11. (in `main`)
Live geprüft mit Start Wetzlar Bahnhof: 5 echte Orthopädie-Praxen, echte Website/Telefon, Weg zu Fuß, Plan B mit dem Auto. Im Headless-Browser der Cloud-Umgebung kommt routing.openstreetmap.de nicht durch (curl mit CORS-Header geht); Test daher mit `page.route`-Weiterleitung. Auf echten Geräten prüfen.
Nächste Feinschliffe: Pins im selben Haus sind gruppiert; Tests für Dienste ergänzen.

### Ursprünglicher Plan (zur Nachverfolgung)
Fertig: `config.ts`, `services/dienste.ts`, `core/osmFach.ts`, neue Typen in `data/praxen.ts`, `lib/plan.ts`, Karte mit wechselndem/fehlendem Startpunkt.
Offen (in dieser Reihenfolge):
1. `App.tsx` umbauen: Zustand `start` (GPS/Adresse, nur im Speicher/sessionStorage), Suche `laden | fehler | leer | fertig` mit Radius 4 → 10 → 25 km, Verkehrsmittel-Umschalter „Zu Fuß / Rad / Auto / Bus & Bahn (folgt, deaktiviert)“, Weglinie beim Öffnen einer Praxis nachladen.
2. Neues Panel „Wo startest du?“ (Standort verwenden / Adresse suchen).
3. `PraxenPanel`: Ladeskelett, Fehler mit „Erneut versuchen“, leer → Umkreis erweitern + Link zur offiziellen Arztsuche 116117 + Hausarztpraxis; Rollstuhl nur laut OSM („rollstuhlgerecht“, „teilweise“), sonst nichts behaupten.
4. `WegPanel`: echte Zeiten je Modus; Kontakt: Website (extern) → sonst Telefon → sonst „keine Kontaktdaten in OpenStreetMap“ + Link zum OSM-Eintrag; Öffnungszeiten aus OSM oder „nicht eingetragen“; Quellenzeile „© OpenStreetMap-Mitwirkende“.
5. Geteilter Link: Praxis per Nominatim `lookup` laden, Begleitperson wählt eigenen Startpunkt (eigener Weg je Person).
6. Tests für `osmFach.ts` und Dienste (mit `scripts/beispieldaten`), Build, Screenshots Telefon/PC hell/dunkel, dann nach `main` mergen (App bleibt unveröffentlicht).

## 6. Danach
- **Partnerschaft mit Team „Find ur Room“** (3D-Gebäudemodell + Weg zum Raum): Lotse führt bis zum Eingang, Find ur Room vom Eingang zum Raum. Bevorzugt: deren Web-Ansicht in Lotse einbetten („Im Gebäude weiter“, Parameter Gebäude + Raum), sonst Link. Wir bauen nicht an ihrer App. Dima schickt deren Projektdatei → Vertrag finalisieren (Namen, Link, Gebäude) und schön gestalten (Claude Docs oder Word).
- ÖPNV nach Michals Bericht (RMV / db.transport.rest, im Browser testen).
- Umfrage auswerten (06.11.: 15 Antworten, ehrlich gezählt 9 Personen, Ø 3,9; 4 Testantworten von Dimas Gerät `gleacc8tm` herausrechnen) und in den Leistungsnachweis.
- Projektseite: Szenario als „Beispielablauf“ kennzeichnen.
- Ausblick für die Präsentation: eigener Server/gekaufte Dienste nach Investition; ein Sprachmodell nur als Übersetzer in Begriffe, nie als Entscheider.

## 7. Commits
Commits laufen als `Claude <noreply@anthropic.com>` mit Co-Author-Zeile (Vorgabe der Umgebung). Ältere Commits stehen auf Dimas Namen.
