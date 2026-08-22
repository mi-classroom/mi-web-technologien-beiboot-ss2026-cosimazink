# ADR 005 — Library-Cleanup & Musik-App

* Status: accepted
* Deciders: Cosima Zink
* Issue: [5](https://github.com/mi-classroom/mi-web-technologien-beiboot-ss2026-cosimazink/issues/7)
* Date: 2026-08-19

## Kontext

Vor dem Bau der Musik-App wurde die Library aufgeräumt (Teil A), danach die ersten Gesten der App selbst entwickelt (Teil B). Mehrfach durch Live-Tests iteriert. Die wichtigsten Learnings daraus stehen unten unter "Gelernt".

## Teil A — Library-Cleanup

Ziel: Duplikate entfernen, Kopplung Library↔App reduzieren, robuster machen

* **Hand-Auswahl dedupliziert** — `selectHands()`/`mirrorHandedness()` (`lib/utils/hands.js`) ersetzen dreifach duplizierten Code in den Hand-Gesten.
* **Visibility-Check dedupliziert** — `visible()` in `utils.js`, ersetzt duplizierte Closures in den drei Pose-Gesten.
* **Zonen-Remapping dedupliziert** — `remapToZone()`/`clampRemap01()` (`lib/utils/zones.js`).
* **MediaPipeSource-Adapter** (`lib/adapters/mediapipe-source.js`) kapselt Kamera-/Modell-Boilerplate — bewusst *nicht* über `lib/index.js` exportiert, damit der Kern DOM-frei bleibt.
* **Fehlerisolation** — `gesture.detect()` läuft pro Geste in try/catch; eine werfende Geste reißt nicht mehr alle anderen mit.
* **Hysterese** (`lib/utils/hysteresis.js`, Schmitt-Trigger) gegen Flackern an Distanz-Schwellen. Hold-Gesten resetteten vorher bei jedem Grenzwert-Zittern komplett neu.

## Teil B — Musik-App

### Kernidee: `TiltGesture`

Eine konfigurierbare Geste (`lib/gestures/tilt.js`): eine feste Fingerform (welche Finger gestreckt/eingerollt sein müssen) schaltet die Geste frei, Drehen des Handgelenks liefert dann einen kontinuierlichen Wert `[0,1]`. Bewusst App-agnostisch: die Geste kennt keine Töne/Frequenzen, nur `{ value, angleDeg }`; was der Wert bedeutet, entscheidet die App.

### Aktueller Stand (`src/app/`)

6 Register, je eine `TiltGesture`-Instanz (linke Hand), definiert in `app/gestures/*.js`:

| Register | Form | Bereich |
|---|---|---|
| Sub-Bass | Zeigefinger | C2 (65–131 Hz) |
| Bass | Zeige + Mittel | G2 (98–196 Hz) |
| Tiefmitten | Zeige + Mittel + Ring | C4 (262–523 Hz) |
| Mitten | Zeige + Mittel + Ring + Klein | E4 (330–659 Hz) |
| Hochmitten | Alle 5 Finger (offene Hand) | G5 (784–1568 Hz) |
| Höhen | Zeige + Klein | C6 (1047–2093 Hz) |

Anker-Töne aus dem C-Dur-Dreiklang (C-E-G), Bereiche als Oktaven angelehnt an die Charakteristik klassischer Mixing/EQ-Frequenzbänder, aber nicht deren exakte (ungleich breite, teils unhörbare) Grenzen. Ton läuft kontinuierlich, kein Quantisieren auf feste Noten (bewusste Entscheidung, siehe "Gelernt"), hörbar solange irgendeine der 6 Formen erkannt wird (keine zweite Hand nötig).

Struktur: `index.html`, `styles.css`, `main.js`, `gestures/*.js` (eine Datei pro Register + `index.js` als Aggregator), komplett isoliert von `src/lib/`.

### Gelernt (wichtigste Stolpersteine)

- **Diskrete Töne vs. kontinuierliche Frequenz:** Ursprünglich Pentatonik-Zonen gewählt (jede Kombination klingt konsonant), nach Live-Test auf kontinuierliches Gleiten umgestellt. Der weiche Verlauf war wichtiger als Treffsicherheit.
- **Rotationsunabhängige Formerkennung:** `tip.y < pip.y` (einfacher Höhenvergleich: Handgelenk liegt tiefer als Finger) bricht bei starker Drehung der Hand. `fingerExtendedRadial()` (Abstand zum Handgelenk statt Y-Vergleich) bleibt dabei korrekt.
- **Daumen ist ein Sonderfall:** Er rollt sich seitlich ein, nicht Richtung Handgelenk — `fingerExtendedRadial` liest ihn deshalb fast immer als "gestreckt". `thumbExtended()` (Abstand zur Zeigefinger-Basis statt zum Handgelenk) funktioniert stattdessen zuverlässig.

### Auswirkungen (kumuliert)

* **Neue öffentliche Exporte (Library):** `TiltGesture` (Kipp-Geste), `angle2D` (Rechen-Hilfsfunktion), `clampRemap01` (Rechen-Hilfsfunktion), `fingerExtendedRadial` (Finger-Streckungs-Prüfung), `thumbExtended` (Finger-Streckungs-Prüfung).
* Keine Breaking Changes an den schon vorhandenen Gesten.
