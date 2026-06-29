# Gesture Library API Design

* Status: accepted
* Deciders: Cosima Zink
* Issue: [3](https://github.com/mi-classroom/mi-web-technologien-beiboot-ss2026-cosimazink/issues/3)
* Date: 2026-06-11

## Context and Problem Statement

Die prototypischen Gesten aus Issue #2 liegen als lose ES-Module vor (`scripts/gestures/`). Diese sind direkt mit der Demo-Anwendung verwoben: sie exportieren Funktionen mit fest verdrahteten Parametern und kein einheitliches Interface. Eine Drittpartei kann sie nicht ohne Quellcode-Kenntnis einsetzen. Es wird eine Library-Struktur benötigt, die Gesten kapselt, erweiterbar macht und eine dokumentierbare API bietet.

## Considered Options

* Option A – Funktionsbasierte API (wie die bestehenden Module)
* Option B – Klassenbasierte API mit zentralem Registry-Objekt
* Option C – Event-Target-basierte API (Web-native CustomEvents)

## Decision Outcome

Gewählt wurde **Option B** – eine klassenbasierte API mit einem zentralen `GestureLibrary`-Objekt und einem `BaseGesture`-Interface.

Kernprinzip: Die Library ist ein geschlossenes Objekt, das Gesten per `register()` aufnimmt und per `detect()` pro Frame auswertet. Ergebnisse werden über `on()`/`off()` als benannte Events zugestellt.

```js
const lib = new GestureLibrary();

lib
  .register(new PinchSwipeGesture())
  .register(new ShoulderTapGesture());

lib.on("pinch-swipe:right", () => Reveal.right());

lib.detect({ handResults, poseResults }, performance.now());
```

### Positive Consequences

* Nutzer brauchen nur `GestureLibrary` und die gewünschten Gesten-Klassen zu importieren
* Neue Gesten lassen sich hinzufügen ohne bestehenden Code zu ändern – nur `register()`
* Alle internen Details (Zustandsmaschinen, Filter, Schwellenwerte) bleiben verborgen
* Gesten sind einzeln konfigurierbar über den Konstruktor: `new PinchSwipeGesture({ pinchHoldMs: 300 })`
* `reset()` ermöglicht sauberes Umschalten zwischen Gesten-Modi (Nah/Fern)

### Negative Consequences

* Klassen sind in funktional geprägtem JS unüblich – etwas mehr Boilerplate als Funktionen
* `detect()` muss jeden Frame manuell aufgerufen werden; die Library verwaltet keine eigene Kamera-Loop

## Pros and Cons of the Options

### Option A – Funktionsbasierte API (bisheriger Stand)

```js
import { getPinchResult }       from "./gestures/pinch-swipe.js";
import { getShoulderTapResult } from "./gestures/shoulder-tap.js";

const r = getPinchResult(handResults, ts);
```

* Gut, weil minimal und direkt
* Gut, weil kein Klassen-Overhead
* Schlecht, weil kein einheitliches Interface – jede Geste hat eine andere Signatur
* Schlecht, weil Erweiterung bedeutet: neue Importzeile und neue Aufrufzeile in der App
* Schlecht, weil kein gemeinsamer Einstiegspunkt für Dokumentation

### Option B – Klassenbasierte API mit Registry (gewählt)

* Gut, weil einheitliches Interface: alle Gesten implementieren `BaseGesture`
* Gut, weil Erweiterung ausschließlich über `register()` – keine App-Änderung nötig
* Gut, weil Konfiguration pro Instanz möglich (`new PinchSwipeGesture({ holdMs: 300 })`)
* Gut, weil Event-System (`on`/`off`) entkoppelt Erkennung von Reaktion
* Schlecht, weil Klassen mehr Boilerplate als Funktionen

### Option C – Event-Target-basierte API

```js
const lib = new EventTarget();
lib.dispatchEvent(new CustomEvent("pinch-right"));
document.addEventListener("pinch-right", handler);
```

* Gut, weil Web-nativ, kein eigenes Event-System nötig
* Schlecht, weil `CustomEvent` und `EventTarget` für diesen Use Case umständlicher zu lesen
* Schlecht, weil globale Events schwerer zu isolieren (z.B. mehrere Library-Instanzen)

## API-Referenz

### `GestureLibrary`

| Methode | Beschreibung |
|---|---|
| `register(gesture)` | Geste registrieren. Gibt `this` zurück (chainbar). |
| `unregister(name)` | Geste nach Name entfernen. |
| `on(event, fn)` | Event-Handler registrieren. |
| `off(event, fn)` | Event-Handler entfernen. |
| `detect({ handResults, poseResults }, ts)` | Einen Frame auswerten. Einmal pro `requestAnimationFrame` aufrufen. |
| `reset(name?)` | Zustand einer oder aller Gesten zurücksetzen. |

### Event-Namen

| Form | Wann | Beispiel |
|---|---|---|
| `"gesture-name"` | Bei jedem Ergebnis (Action oder State) | `"pinch-swipe"` |
| `"gesture-name:action"` | Nur wenn eine Action feuert | `"pinch-swipe:right"` |

### `BaseGesture` Interface

| Member | Typ | Beschreibung |
|---|---|---|
| `name` | `string` (getter) | Eindeutiger Name, wird als Event-Prefix verwendet |
| `requiredInput` | `"hands"\|"pose"` (getter) | Welches MediaPipe-Ergebnis die Geste erwartet |
| `detect(input, ts)` | Methode | Gibt `null`, `{ state }` oder `{ action }` zurück |
| `reset()` | Methode | Internen Zustand zurücksetzen |

### Registrierte Gesten

| Klasse | Name | Input | Actions | States |
|---|---|---|---|---|
| `PinchSwipeGesture` | `"pinch-swipe"` | `"hands"` | `"right"` `"left"` `"up"` `"down"` | `"arming"` `"armed"` |
| `ShoulderTapGesture` | `"shoulder-tap"` | `"pose"` | `"right"` `"left"` | `"holding"` |
| `HandsToHeadGesture` | `"hands-to-head"` | `"pose"` | `"up"` | `"holding"` |
| `HandsToHipsGesture` | `"hands-to-hips"` | `"pose"` | `"down"` | `"holding"` |
| `PinkyPointerGesture` | `"pinky-pointer"` | `"hands"` | — | `"pointing"` + `{x, y}` |
| `PinkyClickGesture` | `"pinky-click"` | `"hands"` | `"click"` + `{x, y}` | — |

## Links

* [Hammer.js API](https://hammerjs.github.io/api/)
* [ZingTouch – Custom Gestures](https://zingchart.github.io/zingtouch/docs/)
* [Fingerpose – GestureDescription](https://github.com/andypotato/fingerpose)
* [ADR 002 – Gesture Heuristics](./002-gesture-heuristics.md)
