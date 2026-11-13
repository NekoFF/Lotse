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

## 4b. Lotse v2 (14.11.2026, in `main`)
Konzept nach Dimas Vorgabe neu: **Karten-App wie Apple/Google Maps mit KI**. EIN Blatt (`src/blatt/`), Suche oben fest, Inhalt wechselt (Start, Ergebnisse, Ort, Route, Termin, Daten & Quellen). Eine Eingabe für alles (`src/core/absicht.ts`: Notfall → Termin → Fach → Kategorie → Anliegen → Ortssuche). Jeder Kartenpunkt antippbar (`services/orte.ts`). Route mit deutschen Schritten. Termine + Losgehzeit + Erinnerung (`lib/termine.ts`). KI auf dem Gerät (`ki/assistent.ts`, WebLLM 0.2.86 + Qwen2.5-0.5B, nur Übersetzer, festes Schema). Beschwerden gehen nie als Text an Dienste. 40 Tests. Alte Panels entfernt (in Git-Historie).
**Abgabeordner für die Lehrkraft:** `~/Documents/Lotse-Abgabe` (Dokumente als docx/html/md, Screenshots, Kooperationsvereinbarung, Quellcode-Zip). Bei Änderungen neu erzeugen.
Dima: „Push wie nötig, nicht fragen“; App bleibt unveröffentlicht, bis er es sagt. Kein Juristen-Overkill – Schulprojekt.

## 5. Umstellung auf Live-Daten – lauffähig in `arbeit/echte-daten` (NOCH NICHT in `main`)
Stand 13.11. abends: Commit 1e798c5 (Live-Daten) + Prüfrunde danach (Claude lokal, im echten Browser mit echten Diensten geprüft, Start Bahnhofstraße 1 Wetzlar: Orthopädie 5, Zahnmedizin 23, HNO 1 Praxis; Weg, Plan B, Öffnungszeiten, Kontakt aus OSM).
Prüfrunde hat behoben:
- **Nutzungsbedingungen:** Die drei Fahrzeit-Anfragen gingen gleichzeitig raus → FOSSGIS antwortete live mit **429** (auch bei 1,1 s Abstand, solange eine langsame Anfrage noch lief). Jetzt je Dienst strikt eine Anfrage nach der anderen, mindestens 1,1 s Abstand, Zwischenspeicher, überholte Ketten brechen ab (`services/dienste.ts`). Gilt je Browser-Tab – für viele Nutzer braucht es später einen eigenen Server/Proxy. Gewähltes Verkehrsmittel zuerst, Liste erscheint sofort, die anderen kommen nach.
- **Quellenangabe:** Karte klappte die OSM-Angabe sofort ein (verstößt gegen OSMF-Richtlinie) → jetzt 5 s sichtbar; Link „Kartenfehler melden“ (FOSSGIS-Bedingung) auf Karte und in den Quellenzeilen; Hinweis „ohne aktuelle Verkehrslage“.
- **Ehrlichkeit:** Ausfall eines Verkehrsmittels heißt jetzt „nicht verfügbar“, nicht „kein Weg“; Umkreis ist ein echter Kreis (vorher Quadrat bis 1,4 × Radius); Hinweis, wenn Nominatim seine Höchstzahl (40) liefert.
- **Datenschutztexte:** „Eingaben bleiben auf diesem Gerät“ und „wird nirgends gespeichert“ waren falsch → korrigiert. Der Text in „Wo startest du?“ sagt jetzt genau, was wohin geht (Adresse/Standort → Nominatim; Start + Praxisorte → FOSSGIS, daraus ist die Art der Praxis ablesbar; Kartenbilder → OpenFreeMap; alle sehen die IP). Projektseite (`site/index.html`, Abschnitt Datenschutz) entsprechend angepasst. Startpunkt wird auf ~10 m gerundet gesendet.
- **Zweite, unabhängige Prüfung** (Review-Agent) fand und es wurde behoben: Sicherheitsfilter ließ sich über „Startpunkt ändern“ umgehen; nach Startwechsel blieben alte Zeiten stehen; nachgeladene Verkehrsmittel froren ein, wenn man früh eine Praxis öffnete; „Erneut versuchen“ wirkungslos; Rollstuhl-Filter griff nicht immer; leere Liste behauptete „keine Praxis“, obwohl Nominatims 40er-Grenze erreicht war (jetzt ehrlicher Text, kein „Umkreis erweitern“, das es nur schlimmer machen würde); kleine Texte („keine Route“, „km Luftlinie“, „die 25 nächsten von N“, Kalender-Erinnerung).
- **Karte:** eigene Stile `public/karte/stil-hell.json`/`stil-dunkel.json`, erzeugt mit `scripts/kartenstil_bauen.py` aus den offiziellen OpenFreeMap-Stilen Positron/Dark (Quellen gespeichert in `scripts/kartenstil/quelle/`): Wasser blau, Parks/Wald grün (Farben wie im ersten Codex-Entwurf), eigene Ebenen für Bus & Bahn, Praxen/Kliniken/Apotheken, sonstige Orte (Maki-Symbole, nur mit Namen), 3D-Gebäude (Knopf „3D“). Bus/Bahn/Praxis/Apotheke-Symbole selbst gezeichnet (`src/map/kartenSymbole.ts`; kein rotes Kreuz auf Weiß, kein Apotheken-„A“). Lizenzen: `public/karte/LIZENZ.txt` (BSD-3 / CC BY 4.0 / CC BY 3.0 / MIT), verlinkt in der Kartenquellenangabe. Tipp auf ein Symbol zeigt Name und Art.
- Erste Telefonnummer bei mehreren, Website nur als http(s); 12 Tests für Dienste (`services/dienste.test.ts`), 29 Tests gesamt, lint ohne Fehler.
Bekannt, offen:
- **Vollständigkeit:** Nominatim liefert höchstens 40 Treffer je Suche; in Wetzlar ist das bei 4 km schon erreicht → Praxen können fehlen (App sagt das). Saubere Lösung: Overpass API (für „alle Praxen im Umkreis“ gedacht) – Entscheidung Dima.
- `npm audit` meldet maplibre-gl 5.24.1 als kritisch (GHSA-jrc7-96c5-q579): Fehlalarm, 5.24.1 enthält die Korrektur (Code geprüft). Dev-Abhängigkeiten (vitest u. a.) haben Meldungen, laufen nur lokal/CI.
- **Vor einer Veröffentlichung Pflicht:** Datenschutzerklärung für die App (Standort an OSMF, FOSSGIS, OpenFreeMap; aus den Praxisorten lässt sich auf Gesundheit schließen → Art. 9 DSGVO, Hinweis/Einwilligung vor der ersten Suche), Impressum-Link in der App, Content-Security-Policy (`connect-src` nur auf die Dienste), Möglichkeit, gemerkte Termine zu löschen.
- **Projektseite (live!):** sammelte E-Mails (Warteliste, Supabase) ohne Impressum/Anbieterkennzeichnung (§ 18 MStV) und ohne Angaben nach Art. 13 DSGVO (wer verantwortlich ist, Kontakt, Rechtsgrundlage, Empfänger Supabase, Rechte, Beschwerde). Am 13.11. sofort entschärft: **Warteliste auf `main` pausiert** (Commit 258aac0); bereits gespeicherte Adressen unberührt. Offen bei Dima: Name + Kontakt (am besten Projekt-E-Mail) + Anschrift für Impressum und Datenschutzhinweis; Umfrage (anonyme Antworten + Gerätekennung im Browser) braucht denselben Hinweis, die Gerätekennung ggf. Einwilligung (§ 25 TDDDG).
- `core/osmFach.ts` (laut Regel nur erweitern): `internal` → Hausarzt, `child_psychiatry` → Kinderarzt, `orthodontics` → Zahnarzt ist fachlich zweifelhaft (Kieferorthopäde bei „Zahn abgebrochen“) – Entscheidung Dima.
- Screenshots Telefon/PC hell/dunkel, Merge nach `main` (App bleibt unveröffentlicht) – erst nach Dimas Okay.

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
