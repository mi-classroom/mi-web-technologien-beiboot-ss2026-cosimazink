# Gesture Heuristics & Algorithm Parameters

* Status: accepted
* Deciders: Cosima Zink
* Issue: [2](https://github.com/mi-classroom/mi-web-technologien-beiboot-ss2026-cosimazink/issues/3)
* Date: 2026-05-20

## Context and Problem Statement

Die Gestensteuerung muss zuverlässig zwischen Absicht und zufälligen Handbewegungen unterscheiden. Dazu werden Schwellenwerte, Zeitfenster und ein Smoothing-Filter benötigt. Diese Entscheidung dokumentiert, warum die gewählten Werte so sind wie sie sind.

## Implementierte Gesten – Pinch + Ziehen (alle vier Richtungen)

Alle vier Navigationsrichtungen werden über dieselbe Grundgeste gesteuert: Pinch einnehmen, halten, in eine Richtung ziehen.

1. **Pinch** einnehmen: Daumenspitze (LM 4) und Zeigefingerspitze (LM 8) zusammen bis Abstand < `PINCH_THRESHOLD (0.08)`.
2. **Halten** bis armed: `PINCH_HOLD_MS (400 ms)`. Während dieser Zeit wird die Position aktualisiert, aber keine Bewegung getrackt. Verhindert, dass das Einnahmen der Pose selbst als Bewegung gezählt wird.
3. **Ziehen**: Bewegung des Pinch-Mittelpunkts wird auf beiden Achsen akkumuliert.
4. **Achse locken**: Sobald eine Achse `AXIS_LOCK_THRESHOLD (0.04)` mit `AXIS_RATIO (2.5)`-facher Dominanz erreicht, wird diese Achse gelockt. Nur noch die gelockte Achse kann auslösen.
5. **Auslösen**: Wenn die gelockte Achse `PINCH_MOVE_DELTA (0.13)` erreicht, feuert die Aktion. Lock und Akkumulatoren werden zurückgesetzt.

| Akkumulator | Vorzeichen | Richtung (Spiegelansicht) | Aktion |
|---|---|---|---|
| `accumX` | negativ | Hand nach rechts | `Reveal.right()` |
| `accumX` | positiv | Hand nach links | `Reveal.left()` |
| `accumY` | negativ | Hand nach oben | `Reveal.up()` |
| `accumY` | positiv | Hand nach unten | `Reveal.down()` |

Mirror-Hinweis: Das Video ist per CSS gespiegelt (`scaleX(-1)`). Die MediaPipe-Koordinaten sind ungespiegelt, daher ist die X-Richtung invertiert.

### Zustandsmaschine

```
IDLE ──(pinch)──► ARMING ──(400 ms)──► ARMED ──(Achse locked + Delta)──► Aktion
  ▲                  |                    |                                    |
  └──(kein Pinch)────┘                    └────────────────────────────────────┘
                                          (Lock resettet, ARMED bleibt)
```

### Warum Achsen-Locking?

Ohne Locking gewinnt bei diagonaler Bewegung zufällig die Achse, die zuerst den Schwellenwert erreicht. Mit Locking wird die Richtung früh (bei `AXIS_LOCK_THRESHOLD`) festgelegt und dann konsequent verfolgt. Diagonale Drift nach dem Lock hat keinen Einfluss mehr auf die Richtungsentscheidung.

## Schwellenwerte

| Konstante | Wert | Einheit | Begründung |
|---|---|---|---|
| `PINCH_THRESHOLD` | 0.08 | normalisiert (0–1) | ~51 px bei 640 px. Komfortabler Pinch ohne Fingerkuppen zu quetschen. |
| `PINCH_HOLD_MS` | 400 ms | Millisekunden | Lang genug um versehentliches Pinchen herauszufiltern, kurz genug für flüssige Bedienung. |
| `AXIS_LOCK_THRESHOLD` | 0.04 | normalisiert | ~26 px. Lock greift früh, bevor Diagonalbewegung die Richtung verfälscht. |
| `AXIS_RATIO` | 2.5 | Faktor | Dominante Achse muss 2,5× so groß sein wie die andere, damit der Lock greift. |
| `PINCH_MOVE_DELTA` | 0.13 | normalisiert | ~83 px akkumulierte Bewegung zum Auslösen. Etwas mehr als AXIS_LOCK_THRESHOLD × AXIS_RATIO, sodass ein klarer Zug nötig ist. |
| `COOLDOWN_MS` | 700 ms | Millisekunden | Mindestpause zwischen zwei Aktionen. Verhindert Mehrfachauslösung. |
| `CONFIDENCE_MIN` | 0.70 | Score 0–1 | Handedness-Score-Schwellenwert. Unter 0.7 zu viel Rauschen. |

## Smoothing – One Euro Filter

Angewendet auf den Pinch-Mittelpunkt (Durchschnitt aus LM 4 und LM 8), separat für X- und Y-Achse pro Hand.

| Parameter | Wert | Bedeutung |
|---|---|---|
| `minCutoff` | 1.0 Hz | Glättung bei langsamer Bewegung. |
| `beta` | 0.05 | Reduziert Lag bei schnellen Bewegungen. |
| `dCutoff` | 1.0 Hz | Standard aus dem Paper. |

Die Parameter wurden manuell explorativ bestimmt.

## Bekannte Schwächen

- **Schlechte Beleuchtung**: Fingerspitzen-Abstands-Messung (Pinch) ist bei schlechtem Licht fehleranfälliger als größere Gesten.
- **Sehr langsame Bewegungen**: Bei sehr langsamer, gleichmäßig diagonaler Bewegung kann der Lock auf der falschen Achse greifen, falls beide gleichzeitig `AXIS_LOCK_THRESHOLD` erreichen. In der Praxis selten, da echte Absichten meistens eine klare Hauptrichtung haben.
- **Beidseitige Erkennung**: Beide Hände können gleichzeitig in Pinch-Pose sein. Die erste Hand (Iteration: links zuerst), die eine Aktion auslöst, gewinnt.

## Bewusst weggelassen

- Start/Stop der Erkennung per Geste
- Weitere Gesten (Faust, Daumen hoch/runter, Zeigefinger)
- Zoom

Begründung: KISS-Prinzip. Eine Grundgeste (Pinch + Ziehen) in vier Richtungen sauber dokumentiert, statt mehrere Gesten halbgar.

## Links

* [One Euro Filter Paper (Casiez et al. 2012)](https://inria.hal.science/hal-00670496)
* [MediaPipe Hand Landmarks](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
* [Reveal.js API](https://revealjs.com/api/)
