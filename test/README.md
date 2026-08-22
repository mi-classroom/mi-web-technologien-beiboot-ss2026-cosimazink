# Tests

```bash
node --test "test/*.test.js"
```

Kein Test-Framework nötig — Node hat seit v18 einen eingebauten Test-Runner (`node:test`).

## Warum genau diese Bereiche

Getestet werden bewusst nur die reinen, deterministischen Rechenfunktionen:
`clampRemap01`/`remapToZone` (Koordinaten-Remapping), `dist2D`/`angle2D` (Geometrie),
`Hysteresis` (Schmitt-Trigger-Zustandsmaschine) und `chordFrequencies` (Musiktheorie-Berechnung).

Das sind die Stellen, an denen ein stiller Rechenfehler am schwersten zu bemerken wäre —
ein falscher Faktor oder ein Vorzeichenfehler in einer dieser Funktionen würde sich erst
Frames später als "die Geste fühlt sich komisch an" oder "der Akkord klingt falsch" zeigen,
nicht als offensichtlicher Absturz.

**Bewusst nicht unit-getestet:**
- **MediaPipe-Erkennung selbst** (`GestureRecognizer`, `PoseLandmarker`) — externe Bibliothek,
  keine eigene Logik, bräuchte echte Kamerabilder als Testdaten.
- **DOM-/Canvas-Interaktion und Audio-Ausgabe** (`main.js`, `mediapipe-source.js`) — brauchen
  eine echte Browser-Umgebung (Kamera, `AudioContext`, `<canvas>`); das wäre eher ein
  End-to-End-Test wert (z. B. mit Playwright) als ein Unit-Test, und würde für den Umfang
  dieses Projekts den Aufwand nicht rechtfertigen.
- **Die Gesten-Klassen selbst** (`TiltGesture`, `PinchSwipeGesture`, …) — ließen sich zwar mit
  synthetischen Landmark-Daten testen, sind aber im Kern dünne Kombinationen der oben bereits
  getesteten Bausteine (`dist2D`, `fingerExtendedRadial`, `Hysteresis`) — die eigentliche
  Fehlerquelle liegt in den Bausteinen, nicht im Zusammensetzen.
