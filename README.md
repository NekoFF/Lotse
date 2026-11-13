# Lotse

**Vom Anliegen bis zur Tür.** Lotse ordnet ein gesundheitliches Anliegen in Alltagssprache einer Fachrichtung zu, zeigt Praxen nach tatsächlicher Fahrzeit und plant den Weg zum Termin. Lotse stellt keine Diagnose und bucht keine Termine.

Projektarbeit an der Werner-von-Siemens-Schule, Schuljahr 2026/27.
Team: Dima (Projektleitung, Umsetzung), Michal (Datenquellen), Abdi (Nutzersicht, Anforderungen), Fateme (Dokumentation).

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/core/` | Fachlogik ohne Oberfläche: Sicherheitsfilter (`safety.ts`), Zuordnung (`match.ts`), Textaufbereitung (`normalize.ts`), Tests |
| `src/data/` | Begriffstabelle, Notfallbegriffe, Fachrichtungen, Beispielpraxen |
| `src/screens/` | Bildschirme der App |
| `src/ui/` | wiederkehrende Bausteine: Navigationsleiste, Tab-Leiste, Symbole |
| `src/styles.css` | Designsystem: Farben, Schrift, Komponenten, helles und dunkles Erscheinungsbild |

Reihenfolge der Verarbeitung: **Sicherheitsfilter → Zuordnung → Praxisliste**. Der Sicherheitsfilter läuft immer zuerst.

## Betrieb

- Kein eigener Server, keine laufenden Kosten. Die App ist eine **Progressive Web App** und läuft komplett im Browser.
- Installierbar auf Android und iPhone über „Zum Home-Bildschirm“.
- Jeder Push auf `main` startet die Tests, baut die App und veröffentlicht sie auf GitHub Pages (`.github/workflows/deploy.yml`).
- Projektseite mit Umfrage: https://nekoff.github.io/Lotse/ · App: https://nekoff.github.io/Lotse/app/
- `site/` enthält die Projektseite. Bewertungen landen in Supabase; Besucher dürfen nur einfügen.

## Lokal starten

```bash
npm install
npm run dev        # Entwicklungsserver
npx vitest run     # Tests
npm run build      # fertige App in dist/
```

## Stand

Prototyp 0.1. Praxen und Fahrzeiten sind **Beispieldaten** und werden durch den geprüften Praxisdatensatz und echte Fahrzeiten ersetzt.
