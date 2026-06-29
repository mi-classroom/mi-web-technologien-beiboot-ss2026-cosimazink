# Web Technologien // begleitendes Projekt Sommersemester 2026

- [Informationen zum Projekt](https://github.com/mi-classroom/mi-web-technologien-beiboot-ss2026-cosimazink/blob/main/PROJECT.md)

## Architecture Decision Records

- [ADR 001 – ML-Library Choice](./adr/001-ml-library-choice.md)
- [ADR 002 – Gesture Heuristics & Algorithm Parameters](./adr/002-gesture-heuristics.md)
- [ADR 003 – Gesture Library API Design](./adr/003-gesture-library-api.md)

## Lokal starten

```bash
npx serve src
```

→ [http://localhost:3000](http://localhost:3000) – Landmark-Demo  
→ [http://localhost:3000/presentation.html](http://localhost:3000/presentation.html) – Präsentation mit Gestensteuerung

> Kein Build-Schritt nötig. Die Anwendung läuft vollständig im Browser via MediaPipe Web SDK.

---

## Gesture Library

Die Library kapselt die Gestenlogik unabhängig von der Demo-Anwendung.  
Sie liegt unter `src/lib/` und hat keine Abhängigkeit zu DOM oder Reveal.js.

### Installation

Kein npm nötig – alles über einen einzigen Einstiegspunkt:

```js
import {
  GestureLibrary,
  PinchSwipeGesture,
  ShoulderTapGesture,
  HandsToHeadGesture,
  HandsToHipsGesture,
  BaseGesture,  // nur nötig wenn du eigene Gesten schreibst
  dist2D,       // optional – Hilfsfunktion für eigene Gesten
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
  .register(new HandsToHipsGesture());

// 3. Auf Gesten reagieren
lib.on("pinch-swipe:right",   () => console.log("→ rechts"));
lib.on("pinch-swipe:left",    () => console.log("← links"));
lib.on("shoulder-tap:right",  () => console.log("→ Schulter-Tap"));
lib.on("hands-to-head:up",    () => console.log("↑ Hände zum Kopf"));
lib.on("hands-to-hips:down",  () => console.log("↓ Hände zur Hüfte"));

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

#### Konfiguration

Alle Gesten akzeptieren ein optionales Konfigurations-Objekt:

```js
new PinchSwipeGesture({
  pinchThreshold: 0.08,  // Abstand Daumen–Zeigefinger für Pinch-Erkennung
  pinchHoldMs:    500,   // Wartezeit bevor Pinch als "armed" gilt (ms)
  pinchMoveDelta: 0.13,  // Mindestbewegung zum Auslösen (normalisiert)
  minScale:       0.10,  // Minimale Handgröße (0 = kein Abstandsgate)
});

new ShoulderTapGesture({
  holdMs:          700,  // Haltezeit vor dem Auslösen (ms)
  shoulderTapDist: 0.12, // Max. Abstand Handgelenk–Schulter
});

new HandsToHeadGesture({ holdMs: 700, headDist: 0.25 });
new HandsToHipsGesture({ holdMs: 700, hipDist:  0.20 });
```

### Eigene Geste schreiben

```js
import { BaseGesture } from "./lib/gesture-base.js";

export class MyGesture extends BaseGesture {
  // Pflicht: eindeutiger Name → wird als Event-Prefix genutzt
  get name() { return "my-gesture"; }

  // "hands" = GestureRecognizer-Ergebnis, "pose" = PoseLandmarker-Ergebnis
  get requiredInput() { return "hands"; }

  detect(input, timestamp) {
    // Landmark-Daten auswerten …

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

### Dateistruktur

```
src/
  lib/                          Gesture Library (keine App-Abhängigkeiten)
    gesture-library.js          GestureLibrary – Hauptklasse
    gesture-base.js             BaseGesture – Interface für eigene Gesten
    gestures/
      pinch-swipe.js            Pinch + Wischen (Hand, Nahbereich)
      shoulder-tap.js           Kreuzgriff zur Schulter (Körper, Fernbereich)
      hands-to-head.js          Hände zum Kopf (Körper, Fernbereich)
      hands-to-hips.js          Hände zur Hüfte (Körper, Fernbereich)
    utils/
      one-euro-filter.js        Signalglättung (intern)
      utils.js                  dist2D, processHoldState (intern)
  scripts/                      Demo-Anwendungen
    gesture-control.js          Gestensteuerung für presentation.html
    gesture-recognition.js      Landmark-Visualisierung für index.html
    gestures/                   Prototyp-Module aus Issue #2 (werden durch lib/ abgelöst)
```
