# ADR 004 — Erkenntnisse aus Issue #4: GestureShop Demo

**Status:** Accepted  
**Date:** 2026-07-13

## Kontext

In Issue #4 wurde die GestureLibrary als externe Abhängigkeit genutzt, in Form einer gesteuerten Shop-Demo (`lib-test.html`, `product.html`). Die App kommuniziert ausschließlich über die öffentliche API (`lib/index.js`) mit der Library. Dabei traten zwei konkrete Probleme auf.

---

## Problem 1 — Kein Signal wenn eine Geste aufhört

Die Library schickt pro Frame ein Event, solange eine Geste erkannt wird. Hört die Geste auf, kommt kein Signal mehr. Die App erhält einfach Stille.

Im Shop wird `PinkyPointerGesture` als Laserpointer genutzt. Der Cursor soll verschwinden, sobald der Nutzer den Finger senkt. Da kein "Ende"-Signal existierte, blieb der Cursor dauerhaft stehen.

Der einzige Ausweg war ein Timeout-Workaround:

```js
let timer;
lib.on("pinky-pointer", ({ x, y }) => {
  zeigeCursor(x, y);
  clearTimeout(timer);
  timer = setTimeout(() => versteckeCursor(), 200);
});
```

Problem: Welche Dauer ist richtig? Zu kurz → Cursor flackert. Zu lang → Cursor bleibt zu lange stehen. Und jede App müsste dieses Muster selbst erfinden.

### Entscheidung

`GestureLibrary.detect()` merkt sich intern, welche Gesten im letzten Frame aktiv waren (`#active` Set). Wenn eine Geste im aktuellen Frame nicht mehr feuert, wird einmalig `"gesture-name:idle"` emittiert.

```js
lib.on("pinky-pointer",      ({ x, y }) => zeigeCursor(x, y));
lib.on("pinky-pointer:idle", ()         => versteckeCursor());
```

Das Event-Schema der Library hat damit drei Formen:
- `"name"` — feuert jeden Frame solange die Geste aktiv ist
- `"name:action"` — feuert einmalig wenn eine Aktion ausgelöst wird
- `"name:idle"` — feuert einmalig wenn die Geste aufhört

### Alternativen verworfen

**Timeout in der App belassen:** Jede App müsste das Muster selbst bauen — vorhersehbarer Boilerplate.

**`isActive(name)` Query-Methode:** Die App müsste den Übergang selbst erkennen. Schiebt die Logik in die falsche Schicht.

**`":end"` statt `":idle"`:** `:idle` beschreibt den Zustand der Geste (untätig), nicht einen Lebenszyklusmoment, konsistenter mit dem bestehenden Namensschema.

---

## Problem 2 — PinkyClickGesture löst versehentlich aus

Die ursprüngliche Click-Geste (Pinky + Daumen gestreckt, übrige Finger eingerollt) liegt zu nah an der Pointer-Geste (nur Pinky gestreckt): beim Zeigen bewegt sich der Daumen mit, was ständig ungewollte Klicks auslöste.

### Entscheidung

`PinkyClickGesture` erfordert jetzt zusätzlich den gestreckten Zeigefinger — das "I love you"-Zeichen (🤟: Pinky + Zeigefinger + Daumen gestreckt, Mittel- und Ringfinger eingerollt). Diese Kombination ist intentional und klar von der Pointer-Geste unterscheidbar.

```js
// vorher — Zeigefinger muss eingerollt sein
const indexCurled = !fingerExtended(lm, 8, 6);

// nachher — Zeigefinger muss gestreckt sein
const indexExtended = fingerExtended(lm, 8, 6);
```

### Alternativen verworfen

**Dwell-Click:** Klick nach ~1s Stillstand. Löst die Überschneidung, ist aber langsamer und weniger intentional.

**Cooldown erhöhen:** Reduziert die Rate versehentlicher Klicks, löst aber nicht die grundlegende Überschneidung der Handformen.
