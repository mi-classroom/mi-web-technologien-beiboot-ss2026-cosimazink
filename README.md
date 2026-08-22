# Web Technologien // begleitendes Projekt Sommersemester 2026

- [Informationen zum Projekt](https://github.com/mi-classroom/mi-web-technologien-beiboot-ss2026-cosimazink/blob/main/PROJECT.md)

## Architecture Decision Records

- [ADR 001 – ML-Library Choice](./adr/001-ml-library-choice.md)
- [ADR 002 – Gesture Heuristics & Algorithm Parameters](./adr/002-gesture-heuristics.md)
- [ADR 003 – Gesture Library API Design](./adr/003-gesture-library-api.md)
- [ADR 004 – Gesture Library API Design](./adr/004-gesture-demo.md)
- [ADR 005 – Library-Cleanup & Musik-App: erste Gesten](./adr/005-application.md)

## Lokal starten

```bash
npx serve src
```

→ [http://localhost:3000](http://localhost:3000) – Reine Handdaten-Ansicht (Landmarks, keine Anwendung)  
→ [http://localhost:3000/app/](http://localhost:3000/app/) – Musik-Anwendung (siehe [ADR 005, Teil B](./adr/005-application.md))

> Kein Build-Schritt nötig. Die Anwendung läuft vollständig im Browser via MediaPipe Web SDK.

---

## Gesture Library

Die Library kapselt die Gestenlogik unabhängig von der Anwendung.  
Sie liegt unter `src/lib/` und hat keine Abhängigkeit zu DOM (Ausnahme: der optionale Adapter unter `lib/adapters/`, siehe [ADR 005](./adr/005-application.md)).

### Installation

Kein npm nötig – alles über einen einzigen Einstiegspunkt:

```js
import {
  GestureLibrary,
  PinchSwipeGesture,
  ShoulderTapGesture,
  HandsToHeadGesture,
  HandsToHipsGesture,
  PinkyPointerGesture,
  PinkyClickGesture,
  TiltGesture,          // konfigurierbare Fingerform + Kippwinkel → [0,1]
  FingerCountGesture,   // zählt gestreckte Finger einer Hand (1-5)
  BaseGesture,           // nur nötig wenn du eigene Gesten schreibst
  dist2D,                // optional – Hilfsfunktion für eigene Gesten
  fingerExtended,        // optional – Hilfsfunktion für eigene Gesten
  fingerExtendedRadial,  // optional – rotationsunabhängige Streckungs-Prüfung
  thumbExtended,         // optional – Daumen-Streckungs-Prüfung (Sonderfall, siehe ADR 005)
  visible,               // optional – Pose-Landmark-Sichtbarkeit prüfen
  angle2D,               // optional – Winkel zwischen zwei Landmarks (Grad)
  selectHands,           // optional – Hände auswählen (Confidence-Filter + Mirror-Korrektur)
  mirrorHandedness,      // optional – MediaPipes Left/Right-Label korrigieren
  remapToZone,           // optional – Koordinate in aktive Kamerazone remappen
  clampRemap01,          // optional – Wert auf [0,1] remappen (geclamped)
  processHoldState,      // optional – Hold-Zustandsmaschine für Pose-Gesten
  Hysteresis,            // optional – Schmitt-Trigger gegen Flackern an einer Schwelle
} from "./lib/index.js";
```

### Schnellstart

```js
// 1. Library instanziieren
const lib = new GestureLibrary();

// 2. Gesten registrieren
lib
  .register(new PinchSwipeGesture())
  .register(new ShoulderTapGesture())
  .register(new HandsToHeadGesture())
  .register(new HandsToHipsGesture())
  .register(new PinkyPointerGesture())
  .register(new PinkyClickGesture({ cooldownMs: 2000 }));

// 3. Auf Gesten reagieren
lib.on("pinch-swipe:right",  () => console.log("→ rechts"));
lib.on("pinch-swipe:left",   () => console.log("← links"));
lib.on("pinch-swipe:up",  () => console.log("↑ hoch"));
lib.on("pinch-swipe:down",   () => console.log("↓ runter"));
lib.on("shoulder-tap:right", () => console.log("→ Schulter-Tap"));
lib.on("hands-to-head:up",   () => console.log("↑ Hände zum Kopf"));
lib.on("hands-to-hips:down", () => console.log("↓ Hände zur Hüfte"));
lib.on("pinky-pointer",      ({ x, y }) => moveCursor(x, y));
lib.on("pinky-click",        ({ x, y }) => triggerClick(x, y));

// 4. Einmal pro Frame aufrufen (innerhalb der requestAnimationFrame-Loop)
lib.detect({ handResults, poseResults }, performance.now());
```

### API

#### `GestureLibrary`

| Methode | Beschreibung |
|---|---|
| `register(gesture)` | Geste registrieren. Gibt `this` zurück (chainbar). |
| `unregister(name)` | Geste nach Name entfernen. |
| `on(event, fn)` | Event-Handler registrieren. |
| `off(event, fn)` | Event-Handler entfernen. |
| `detect({ handResults, poseResults }, timestamp)` | Einen Frame auswerten. |
| `reset(name?)` | Zustand einer oder aller Gesten zurücksetzen. |

**Event-Namen**

| Form | Beschreibung | Beispiel |
|---|---|---|
| `"gesture-name"` | Jedes Ergebnis (Action oder State) | `lib.on("pinch-swipe", ...)` |
| `"gesture-name:action"` | Nur wenn Action feuert | `lib.on("pinch-swipe:right", ...)` |

Der Callback erhält `{ action }` oder `{ state }`:

```js
lib.on("pinch-swipe", ({ action, state }) => {
  if (action) console.log("Aktion:", action); // "right" | "left" | "up" | "down"
  if (state)  console.log("Status:", state);  // "arming" | "armed"
});
```

#### Verfügbare Gesten

| Klasse | Event-Name | Modus | Actions | States |
|---|---|---|---|---|
| `PinchSwipeGesture` | `"pinch-swipe"` | Hand nah | `right` `left` `up` `down` | `arming` `armed` |
| `ShoulderTapGesture` | `"shoulder-tap"` | Körper fern | `right` `left` | `holding` |
| `HandsToHeadGesture` | `"hands-to-head"` | Körper fern | `up` | `holding` |
| `HandsToHipsGesture` | `"hands-to-hips"` | Körper fern | `down` | `holding` |
| `PinkyPointerGesture` | `"pinky-pointer"` | Hand nah | — | `pointing` |
| `PinkyClickGesture` | `"pinky-click"` | Hand nah | `click` | — |
| `TiltGesture` | konfigurierbar (`name`) | Hand nah | — | `tilting` |
| `FingerCountGesture` | konfigurierbar (`name`) | Hand nah | — | `showing` |

`PinkyPointerGesture` und `PinkyClickGesture` geben bei `pointing`/`click` zusätzlich `{ x, y }` mit (normalisierte Bildschirmkoordinaten, bereits zone-remappt).

`TiltGesture` gibt bei `tilting` zusätzlich `{ value, angleDeg }` mit (Kippwinkel der Hand, `value` remapped auf `[0,1]`) – eine feste Fingerform dient dabei als Freischalt-Gate, `name` und `fingers` sind Pflichtoptionen. Mehrere Instanzen mit unterschiedlichen Formen lassen sich nebeneinander registrieren (siehe Musik-App, [ADR 005](./adr/005-application.md)).

`FingerCountGesture` gibt bei `showing` zusätzlich `{ count }` mit (1-5, Anzahl gestreckter Finger – unabhängig davon, welche genau).

#### Konfiguration

Alle Gesten akzeptieren ein optionales Konfigurations-Objekt:

```js
new PinchSwipeGesture({
  pinchThreshold:   0.08,  // Abstand Daumen–Zeigefinger für Pinch-Erkennung ("Einschalt"-Schwelle)
  hysteresisFactor: 1.25,  // "Ausschalt"-Schwelle = pinchThreshold * dieser Faktor, verhindert Flackern
  pinchHoldMs:      500,   // Wartezeit bevor Pinch als "armed" gilt (ms)
  pinchMoveDelta:   0.13,  // Mindestbewegung zum Auslösen (normalisiert)
  minScale:         0.10,  // Minimale Handgröße (0 = kein Abstandsgate)
});

// hysteresisFactor gilt genauso für die drei Hold-Gesten (Default 1.25):
new ShoulderTapGesture({ holdMs: 700, shoulderTapDist: 0.12 });
new HandsToHeadGesture({ holdMs: 700, headDist: 0.25 });
new HandsToHipsGesture({ holdMs: 700, hipDist:  0.20 });

new PinkyPointerGesture({
  zoneX: [0.15, 0.85],  // Aktive Kamerazone horizontal (kleiner = leichter zu erreichen)
  zoneY: [0.10, 0.90],  // Aktive Kamerazone vertikal
});

new PinkyClickGesture({
  cooldownMs:     2000,  // Mindestabstand zwischen zwei Klicks (ms)
  thumbExtendMin: 0.10,  // Mindestabstand Daumenspitze–Zeigefingergrundgelenk
  zoneX: [0.15, 0.85],
  zoneY: [0.10, 0.90],
});

new TiltGesture({
  name:  "my-tilt",      // Pflicht – eindeutiger Name, wird als Event-Name genutzt
  hand:  "Left",         // "Left" | "Right" | "any" (Default)
  fingers: { thumb: false, index: true, middle: false, ring: false, pinky: false }, // Freischalt-Gate
  angleRange: [-60, 60], // Grad, komfortabler Kipp-Bereich → [0,1]
  minCutoff: 1.0,        // OneEuroFilter: niedriger = ruhiger im Stillstand
  beta:      0.05,       // OneEuroFilter: höher = weniger Lag bei schneller Bewegung
});

new FingerCountGesture({
  name: "my-count", // Pflicht – eindeutiger Name
  hand: "Right",     // "Left" | "Right" | "any" (Default)
});
```

### Eigene Geste schreiben

```js
import { BaseGesture } from "./lib/index.js";

export class MyGesture extends BaseGesture {
  // Pflicht: eindeutiger Name → wird als Event-Prefix genutzt
  get name() { return "my-gesture"; }

  // "hands" = GestureRecognizer-Ergebnis, "pose" = PoseLandmarker-Ergebnis
  get requiredInput() { return "hands"; }

  detect(input, timestamp) {
    // Nichts erkannt:
    return null;

    // Geste baut sich auf:
    return { state: "preparing" };

    // Geste ausgelöst:
    return { action: "my-action" };
  }

  reset() {
    // Internen Zustand zurücksetzen
  }
}

// Einbinden:
lib.register(new MyGesture());
lib.on("my-gesture:my-action", () => { /* ... */ });
```

Für Hand-Gesten übernehmen `selectHands()` und `remapToZone()` typische Vorarbeit:

```js
import { BaseGesture, selectHands, remapToZone } from "./lib/index.js";

export class MyGesture extends BaseGesture {
  get name() { return "my-gesture"; }
  get requiredInput() { return "hands"; }

  detect(handResults, ts) {
    const hands = selectHands(handResults, 0.7); // { Left, Right }, Mirror-korrigiert
    const lm = hands.Right;
    if (!lm) return null;

    const { x, y } = remapToZone(lm[8].x, lm[8].y, [0.15, 0.85], [0.10, 0.90]);
    return { state: "active", x, y };
  }
}
```

### MediaPipeSource (optionaler Adapter)

Die Library selbst ist DOM-frei und kennt weder Kamera noch MediaPipe-Modelle – sie nimmt nur `{ handResults, poseResults }` entgegen. Wer sich das MediaPipe-Boilerplate (Modelle laden, Kamera starten, `requestAnimationFrame`-Loop) sparen will, kann optional `MediaPipeSource` importieren. Liegt bewusst **nicht** in `lib/index.js`, sondern in einem eigenen Adapter-Modul – siehe [ADR 005](./adr/005-application.md):

```js
import { GestureLibrary, PinkyPointerGesture } from "./lib/index.js";
import { MediaPipeSource } from "./lib/adapters/mediapipe-source.js";

const lib = new GestureLibrary().register(new PinkyPointerGesture());
lib.on("pinky-pointer", ({ x, y }) => moveCursor(x, y));

const source = new MediaPipeSource({
  hands: true,
  pose: false,            // welche Modelle laden
  targetBrightness: 130,  // Ziel-Helligkeit der Auto-Belichtungskorrektur, 0-255 (Default)
  contrast: 1.15,          // fester Kontrast-Boost (Default)
});
source.on("frame", (input, ts) => lib.detect(input, ts));
await source.start(document.querySelector("video"));  // startet Kamera + Loop
```

Die Erkennung läuft auf einer automatisch belichtungskorrigierten Kopie des Kamerabilds, nicht dem rohen Video – die sichtbare `<video>`-Vorschau bleibt unverändert. Das gleicht aus, wenn die Kamera-Belichtung bei sehr hellem (z. B. Gegenlicht) oder sehr dunklem Hintergrund aus dem für das Modell verwertbaren Bereich rutscht: Helligkeit wird periodisch gemessen und der Korrekturfaktor geglättet + geclamped an `targetBrightness` angenähert (nie sprunghaft, nie absurd hoch). `source.debugCanvas` gibt genau diesen korrigierten Canvas zurück – z. B. um bei einer Präsentation live zu zeigen, wie stark gerade korrigiert wird (siehe Toggle-Button in der Musik-App).

### Dateistruktur

```
src/
  lib/                          Gesture Library (keine App-Abhängigkeiten)
    index.js                    Einziger öffentlicher Einstiegspunkt
    gesture-library.js          GestureLibrary – Hauptklasse
    gesture-base.js             BaseGesture – Interface für eigene Gesten
    gestures/
      pinch-swipe.js            Pinch + Wischen (Hand, Nahbereich)
      shoulder-tap.js           Kreuzgriff zur Schulter (Körper, Fernbereich)
      hands-to-head.js          Hände zum Kopf (Körper, Fernbereich)
      hands-to-hips.js          Hände zur Hüfte (Körper, Fernbereich)
      pinky-pointer.js          Kleinfinger → Cursor bewegen (Hand, Nahbereich)
      pinky-click.js            Kleinfinger + Daumen → Klick (Hand, Nahbereich)
      tilt.js                   TiltGesture – konfigurierbare Fingerform + Kippwinkel → [0,1]
      finger-count.js           FingerCountGesture – zählt gestreckte Finger einer Hand (1-5)
    utils/
      one-euro-filter.js        Signalglättung
      utils.js                  dist2D, fingerExtended, fingerExtendedRadial, thumbExtended, visible, angle2D, processHoldState
      hands.js                  selectHands, mirrorHandedness
      zones.js                  remapToZone, clampRemap01
      hysteresis.js             Hysteresis (Schmitt-Trigger gegen Flackern an einer Schwelle)
    adapters/
      mediapipe-source.js       Optionaler MediaPipe-Adapter (Kamera + Modelle + Frame-Loop + Auto-Belichtungskorrektur), DOM-Abhängigkeit bewusst isoliert vom Kern
  index.html                     Reine Handdaten-Ansicht (Landmarks, keine Anwendung)
  scripts/
    gesture-recognition.js       Landmark-Visualisierung für index.html
  app/                            Musik-Anwendung (alles Anwendungsspezifische, isoliert von lib/)
    index.html
    styles.css
    main.js                       Zwei Instrumente per Umschalt-Button: Töne per Register (Button 1) und Akkorde + Filter (Button 2), Audio, Kamera, Verdrahtung
    chords.js                     A-Dur-Dreiklangs-Tabelle für den Akkord-Modus (Button 2)
    gestures/                     Eine Datei pro Register-Geste (Button 1)
      sub-bass.js
      bass.js
      low-mid.js
      mid.js
      hi-mid.js
      high.js
      index.js                    Fasst alle 6 zu REGISTERS zusammen
```
