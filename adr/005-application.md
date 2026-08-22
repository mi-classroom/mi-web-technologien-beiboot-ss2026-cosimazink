# ADR 005 — Library-Cleanup & Musik-App

* Status: accepted
* Deciders: Cosima Zink
* Issue: [5](https://github.com/mi-classroom/mi-web-technologien-beiboot-ss2026-cosimazink/issues/7)
* Date: 2026-08-19

## Kontext

Vor dem Bau der Musik-App wurde die Library aufgeräumt (Teil A), danach die ersten Gesten der App selbst entwickelt (Teil B). Mehrfach durch Live-Tests iteriert. Die wichtigsten Learnings daraus stehen unten unter "Gelernt".

## Entscheidung: Weg A (Vision-Anwendung)

Issue #7 stellt zur Wahl: Weg A (Vision-Anwendung: zeigen, was mit der Library möglich ist, wenn man Zeit reinsteckt) oder Weg B (Vertiefung: eine konkrete Schwachstelle aus Issue #4 sauber lösen).

**Entscheidung: Weg A.**

**Warum:** Issue #4 (Shop-Demo) hatte gezeigt, dass die Library als API funktioniert, aber noch nicht, wofür sich der Aufwand lohnt. Ziel von Weg A ist genau das: an einem echten, in sich stimmigen Anwendungsfall zeigen, wie man mit der Library überhaupt eine Anwendung aufbaut. Von der Gesten-Registrierung über die Event-Verdrahtung bis zur eigentlichen App-Logik (hier: ein gestengesteuertes Instrument) und dabei praktisch demonstrieren, was mit vergleichsweise wenig Code möglich ist. Interessenten, die die Library evaluieren, sehen an einem funktionierenden Instrument in Sekunden, wofür sie taugt; das war mit der Wahl wichtiger als eine isolierte technische Optimierung. Eine Vision-Anwendung ist damit auch das bessere Vorzeigestück.

**Alternative (Weg B) — warum nicht:** Vertiefung an einer konkreten Schwachstelle (z. B. Robustheit bei schlechten Lichtverhältnissen) wäre die technisch "sauberere", enger fokussierte Wahl gewesen. Am Ende ist ein Stück davon trotzdem passiert: die Auto-Belichtungskorrektur in `MediaPipeSource` (siehe "Gelernt" unten) ist im Kern eine Weg-B-artige Vertiefung, motiviert durch ein echtes Robustheitsproblem, das erst beim Live-Testen der Musik-App auffiel. Der Unterschied: Hier ist sie Mittel zum Zweck innerhalb der Vision-Anwendung, nicht das Hauptprojekt selbst.

## Teil A — Library-Cleanup

Ziel: Duplikate entfernen, Kopplung Library↔App reduzieren, robuster machen

* **Hand-Auswahl dedupliziert** — `selectHands()`/`mirrorHandedness()` (`lib/utils/hands.js`) ersetzen dreifach duplizierten Code in den Hand-Gesten.
* **Visibility-Check dedupliziert** — `visible()` in `utils.js`, ersetzt duplizierte Closures in den drei Pose-Gesten.
* **Zonen-Remapping dedupliziert** — `remapToZone()`/`clampRemap01()` (`lib/utils/zones.js`).
* **MediaPipeSource-Adapter** (`lib/adapters/mediapipe-source.js`) kapselt Kamera-/Modell-Boilerplate. Ursprünglich bewusst *nicht* über `lib/index.js` exportiert, damit der Kern DOM-frei bleibt und ein Import von `lib/index.js` keine Netzwerk-Abhängigkeit zur MediaPipe-CDN erzwingt. Später revidiert (siehe "Revision" unten) zugunsten von "Anwendung nutzt die Library ausschließlich über die öffentliche API". Der Adapter wird jetzt mit-exportiert, die DOM-/Netzwerk-Abhängigkeit hängt dadurch transitiv an jedem Import von `lib/index.js`.
* **Fehlerisolation** — `gesture.detect()` läuft pro Geste in try/catch; eine werfende Geste reißt nicht mehr alle anderen mit.
* **Hysterese** (`lib/utils/hysteresis.js`, Schmitt-Trigger) gegen Flackern an Distanz-Schwellen. Hold-Gesten resetteten vorher bei jedem Grenzwert-Zittern komplett neu.

## Teil B — Musik-App

### Kernidee: `TiltGesture`

Eine konfigurierbare Geste (`lib/gestures/tilt.js`): eine feste Fingerform (welche Finger gestreckt/eingerollt sein müssen) schaltet die Geste frei, Drehen des Handgelenks liefert dann einen kontinuierlichen Wert `[0,1]`. Bewusst App-agnostisch: die Geste kennt keine Töne/Frequenzen, nur `{ value, angleDeg }`; was der Wert bedeutet, entscheidet die App.

### Aktueller Stand (`src/app/`)

Zwei Modi, per Button umschaltbar (`body[data-mode]`). Pro Frame läuft nur die `GestureLibrary`-Instanz des aktiven Modus (`toneLib`/`chordLib`). Die jeweils andere Hand hat im falschen Modus dadurch garantiert keine Wirkung, ganz ohne Sonderfall-Prüfungen im Code.

#### Modus 1: Töne (Button 1)

6 Register, je eine `TiltGesture`-Instanz (linke Hand), definiert in `app/gestures/*.js`:

| Register | Form | Bereich |
|---|---|---|
| Sub-Bass | Zeigefinger | C2 (65–131 Hz) |
| Bass | Zeige + Mittel | G2 (98–196 Hz) |
| Tiefmitten | Zeige + Mittel + Ring | C4 (262–523 Hz) |
| Mitten | Zeige + Mittel + Ring + Klein | E4 (330–659 Hz) |
| Hochmitten | Alle 5 Finger (offene Hand) | G5 (784–1568 Hz) |
| Höhen | Zeige + Klein | C6 (1047–2093 Hz) |

Anker-Töne aus dem C-Dur-Dreiklang (C-E-G), Bereiche als Oktaven angelehnt an die Charakteristik klassischer Mixing/EQ-Frequenzbänder, aber nicht deren exakte (ungleich breite, teils unhörbare) Grenzen. Ton läuft kontinuierlich, kein Quantisieren auf feste Noten (bewusste Entscheidung, siehe "Gelernt"), hörbar solange irgendeine der 6 Formen erkannt wird. Rechte Hand hat in diesem Modus keine Funktion.

#### Modus 2: Akkorde (Button 2)

Rechte Hand wählt per Fingeranzahl (`FingerCountGesture`, `lib/gestures/finger-count.js`) eine von 5 diatonischen Stufen in A-Dur (I–V, Tabelle in `app/chords.js`), die als Dur-/Moll-Dreiklang (3 Sägezahn-Oszillatoren durch einen gemeinsamen Tiefpassfilter) gleichzeitig erklingt. Linke Hand behält denselben Mechanismus (`TiltGesture`, offene Hand als Gate) bei, steuert damit aber nicht mehr eine Frequenz, sondern die Grenzfrequenz des Filters (Klangfarbe/Helligkeit) — bewusst kein zweiter melodischer Ton, siehe "Gelernt".

Struktur: `index.html`, `styles.css`, `main.js` (zwei komplett getrennte `GestureLibrary`-Instanzen, eine pro Modus), `chords.js` (Akkord-Tabelle für Modus 2), `gestures/*.js` (eine Datei pro Register für Modus 1 + `index.js` als Aggregator), komplett isoliert von `src/lib/`.

### Gelernt (wichtigste Stolpersteine)

- **Diskrete Töne vs. kontinuierliche Frequenz:** Ursprünglich Pentatonik-Zonen gewählt (jede Kombination klingt konsonant), nach Live-Test auf kontinuierliches Gleiten umgestellt. Der weiche Verlauf war wichtiger als Treffsicherheit.
- **Rotationsunabhängige Formerkennung:** `tip.y < pip.y` (einfacher Höhenvergleich: Handgelenk liegt tiefer als Finger) bricht bei starker Drehung der Hand. `fingerExtendedRadial()` (Abstand zum Handgelenk statt Y-Vergleich) bleibt dabei korrekt.
- **Daumen ist ein Sonderfall:** Er rollt sich seitlich ein, nicht Richtung Handgelenk. `fingerExtendedRadial` liest ihn deshalb fast immer als "gestreckt". `thumbExtended()` (Abstand zur Zeigefinger-Basis statt zum Handgelenk) funktioniert stattdessen zuverlässig.
- **Freie Tonhöhe passt nicht zu festen Akkorden:** Für Modus 2 zunächst überlegt, die linke Hand weiter eine frei gleitende Frequenz spielen zu lassen (wie in Modus 1). Verworfen: ein nicht quantisierter Ton trifft fast nie einen zum gerade klingenden Akkord passenden Ton und klingt dauerhaft dissonant. Stattdessen steuert die linke Hand jetzt einen Tiefpassfilter (Klangfarbe) ein Parameter, der bei jedem Akkord "richtig" klingt, weil er keine eigene Tonhöhe hat.
- **Sägezahn statt Sinus für Modus 2:** Ein Tiefpassfilter auf eine reine Sinuswelle hat keine hörbare Wirkung (keine Obertöne zum Wegschneiden). Die drei Akkord-Oszillatoren laufen deshalb als Sägezahn, der Lead-Ton in Modus 1 bleibt Sinus.
- **Zwei getrennte `GestureLibrary`-Instanzen statt einer gemeinsamen:** Verhindert, dass die im jeweils anderen Modus "falsche" Hand versehentlich Einfluss auf Audio hat. Trennung passiert dadurch strukturell (welche Instanz überhaupt `detect()` bekommt), nicht durch Sonderfall-Prüfungen im Gesten- oder Audio-Code.
- **Gegenlicht/sehr helle Hintergründe machen Handerkennung unzuverlässig:** Kameras belichten bei hellem Hintergrund automatisch ab, die Hand im Vordergrund wird zu dunkel für zuverlässiges Tracking. `MediaPipeSource` misst deshalb periodisch die Bildhelligkeit und korrigiert (geglättet, geclamped) auf einer Kopie des Frames, bevor sie an MediaPipe geht — die sichtbare Vorschau bleibt unverändert. `source.debugCanvas` macht diese korrigierte Kopie für Präsentationen sichtbar.

### Auswirkungen (kumuliert)

* **Neue öffentliche Exporte (Library):** `TiltGesture` (Kipp-Geste), `FingerCountGesture` (zählt gestreckte Finger einer Hand), `angle2D` (Rechen-Hilfsfunktion), `clampRemap01` (Rechen-Hilfsfunktion), `fingerExtendedRadial` (Finger-Streckungs-Prüfung), `thumbExtended` (Finger-Streckungs-Prüfung).
* **`MediaPipeSource`:** neue Optionen `targetBrightness`/`contrast` (Auto-Belichtungskorrektur) und `debugCanvas`-Getter, keine Breaking Changes an bestehender API.
* Keine Breaking Changes an den schon vorhandenen Gesten.

### Revision: MediaPipeSource jetzt über `lib/index.js` exportiert

Beim Abgleich gegen die Issue-Checkliste fiel auf: `src/app/main.js` importierte `MediaPipeSource` direkt aus `lib/adapters/mediapipe-source.js`, an `lib/index.js` vorbei. Ein Verstoß gegen "Anwendung nutzt die Library ausschließlich über die öffentliche API" (siehe auch [ADR 004](./004-gesture-demo.md), das genau das als öffentliche API definiert).

`MediaPipeSource` wird jetzt zusätzlich aus `lib/index.js` re-exportiert (`main.js` importiert entsprechend nur noch von dort). Der ursprüngliche Grund für die Trennung (Kern soll DOM-frei bleiben, kein erzwungener Netzwerk-Import der MediaPipe-CDN) bleibt als Nachteil bestehen und wird bewusst in Kauf genommen.

## Reflexion

**Was macht diese Anwendung besonders:** Kein einzelner Sound-Regler, sondern zwei bewusst unterschiedliche Interaktionsideen auf derselben Gesten-Mechanik (`TiltGesture`): ein freier, kontinuierlicher Ton fürs "Erspüren" von Tonhöhe (Theremin-artig) in Modus 1, und ein zweiter Modus, der dieselbe Handgeste komplett umwidmet: vom Frequenz-Regler zum Klangfarbe-Regler für feste Akkorde. Beide Modi teilen sich Bibliothek und Gesten-Erkennung, sogar dieselbe Fingerform, unterscheiden sich aber komplett darin, was sie musikalisch bedeuten.

**Größte Herausforderung:** Die zuverlässige Erkennung der Gesten: das zieht sich durch praktisch das ganze Projekt und wurde erst durch wiederholtes Live-Testen sichtbar. Mehrere unabhängige Probleme mussten gelöst werden, bevor sich eine Geste überhaupt verlässlich anfühlte: ein einfacher Y-Höhenvergleich für "Finger gestreckt" bricht bei gedrehter Hand (`fingerExtendedRadial()` als rotationsunabhängige Alternative), der Daumen verhält sich anatomisch anders als die anderen vier Finger und braucht eine eigene Prüfung (`thumbExtended()`), Zustände an einer Schwelle flackern ohne Hysterese, und zuletzt die Erkenntnis, dass selbst die Kamera-Belichtung selbst zum Problem wird: bei hellem Hintergrund wird die Hand im Vordergrund zu dunkel für zuverlässiges Tracking, gelöst durch eine automatische, geglättete Belichtungskorrektur in MediaPipeSource. Keines dieser Probleme ist für sich groß, aber zusammen zeigen sie: der schwierige Teil an gestenbasierter Interaktion ist nicht das Konzept, sondern dass die Erkennung unter echten, unkontrollierten Bedingungen (Beleuchtung, Handhaltung, Kamera-Qualität) robust bleibt.
