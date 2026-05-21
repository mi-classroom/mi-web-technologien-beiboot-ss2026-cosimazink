# Gesture Heuristics & Algorithm Parameters

* Status: accepted
* Deciders: Cosima Zink
* Issue: [2](https://github.com/mi-classroom/mi-web-technologien-beiboot-ss2026-cosimazink/issues/3)
* Date: 2026-05-21

## Context and Problem Statement

Die Gestensteuerung muss zuverlässig zwischen Absicht und zufälligen Handbewegungen unterscheiden. Zwei Nutzungskontexte werden unterschieden: **Nahbereich** (Person sitzt/steht nahe der Kamera, präsentiert am Laptop) und **Fernbereich** (Person steht ~2 m+ entfernt, präsentiert vor Publikum). Je nach Distanz sind andere Körperdaten verfügbar und andere Gesten sinnvoll.

---

## Schritt 1: Gestenvokabular

### Mapping-Tabelle

| Interaktion | Geste Nahbereich | Daten & Reliabilität (nah) | Geste Fernbereich | Daten & Reliabilität (fern) |
|:---|:---|:---|:---|:---|
| Nächste Folie (→) | Pinch halten + nach rechts ziehen | Hand-Landmarks (LM 4, 8) über GestureRecognizer; zuverlässig bis ~1,5 m. False Positives bei natürlichen Handbewegungen möglich. | Linke Hand auf rechte Schulter halten | Pose-Landmarks (LM 15, 12); unnatürliche Pose → kaum versehentlich. Requires full upper body in frame. |
| Vorherige Folie (←) | Pinch halten + nach links ziehen | Wie oben. Verwechslung mit diagonal mgl., Achsen-Lock reduziert das. | Rechte Hand auf linke Schulter halten | Pose-Landmarks (LM 16, 11); unnatürliche Pose → kaum versehentlich. Erfordert oberen Körper im Bild. |
| Nächste vertikale Folie (↓) | Pinch halten + nach unten ziehen | Hand-Landmarks (LM 4, 8); vertikale Bewegung intuitiv. False Positives bei natürlichen Handbewegungen möglich. | Beide Hände an die Hüfte halten | Pose-Landmarks (LM 15→23, 16→24) |
| Vorherige vertikale Folie (↑) | Pinch halten + nach oben ziehen | Hand-Landmarks (LM 4, 8); zuverlässig bis ~1,5 m. False Positives bei natürlichen Handbewegungen möglich. | Beide Hände an den Kopf halten | Pose-Landmarks (LM 15, 16 nahe LM 0); beide Arme gleichzeitig heben kommt beim Präsentieren nicht vor, kaum versehentlich. |

| Präsentation starten / Vollbild | Daumen hoch (Thumb_Up) | GestureRecognizer erkennt nativ; zuverlässig bei guter Beleuchtung. | Arm gerade nach oben strecken (eine Hand) | Pose-Landmarks (Handgelenk deutlich über Kopf); klar, aber Verwechslung mit „Ich melde mich"-Geste. |
| Zur Übersicht / Escape | Offene Hand, Handfläche zur Kamera (Stop-Geste) | GestureRecognizer (Open_Palm); zuverlässig, aber versehentliches Auslösen beim Gestikulieren möglich. | Beide Arme nach vorne strecken | Pose-Landmarks; unnatürlich genug, kaum Fehlauslösungen. |

### Auswahl und Begründung

Implementiert wurden **vier Navigationsgesten** (vor, zurück, hoch, runter) in zwei Modusvarianten:

**Nahbereich – Pinch + Ziehen:**
Pinch (Daumen + Zeigefinger) + gerichtete Bewegung wurde gewählt, weil es einen klaren Übergang zwischen „keine Geste" (Finger offen) und „Geste aktiv" (Finger geschlossen) gibt. Der Pinch-Trigger ist schwerer versehentlich zu aktivieren als z. B. eine einfache Wischbewegung. Zeigefinger-Pointing (ursprünglich evaluiert) wurde verworfen, weil der Übergang zwischen „Finger zeigt zufällig in eine Richtung" und „intentionaler Zeigegeste" algorithmisch schwer zu fassen ist.

**Fernbereich – Körperposen:**
Kreuzgriff zur gegenüberliegenden Schulter (links/rechts) und symmetrische Doppelposen (beide Hände Kopf/Hüfte) wurden gewählt, weil sie im Alltag eher nicht versehentlich vorkommen.

---

## Schritt 2: Implementierung

### Distanzbasierter Moduswechsel

Der Modus wird automatisch anhand der scheinbaren Handgröße im Kamerabild bestimmt:

```
Handgröße = dist2D(LM 0, LM 12)   // Handgelenk → Mittelfinger-Spitze, normalisiert
```

| Bedingung | Modus | Aktive Gesten |
|---|---|---|
| Handgröße ≥ 0.10 | Nahbereich | Pinch + Ziehen (alle 4 Richtungen) |
| Keine Hand mit Größe ≥ 0.10 sichtbar | Fernbereich | Körperposen (alle 4 Richtungen) |

Die Schwelle 0.10 entspricht bei einer typischen Webcam (~70° horizontales FOV) etwa 1,7–2 m Abstand. Beim Moduswechsel werden alle ausstehenden Pose-States sofort zurückgesetzt, damit kein halbfertiger Haltevorgang aus dem anderen Modus nachwirkt.

### Nahbereich – Pinch + Ziehen (alle vier Richtungen)

1. **Pinch** einnehmen: Daumenspitze (LM 4) und Zeigefingerspitze (LM 8) zusammen bis Abstand < `PINCH_THRESHOLD (0.08)`.
2. **Halten** bis armed: `PINCH_HOLD_MS (500 ms)`. Während dieser Zeit wird die Position aktualisiert, aber keine Bewegung getrackt. Verhindert, dass das Einnahmen der Pose selbst als Bewegung gezählt wird.
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

#### Zustandsmaschine Nahbereich

```
IDLE ──(pinch)──► ARMING ──(500 ms)──► ARMED ──(Achse locked + Delta)──► Aktion
  ▲                  |                    |                                    |
  └──(kein Pinch)────┘                    └────────────────────────────────────┘
                                          (Lock resettet, ARMED bleibt)
```

### Fernbereich – Körperposen

Alle vier Fernbereichs-Gesten teilen dieselbe Zustandsmaschine (`processHoldState`):

```
IDLE ──(Pose aktiv)──► HOLDING ──(700 ms)──► FIRED ──► Aktion
  ▲                                              |
  └──────────────(Pose losgelassen)──────────────┘
```

| Geste | Bedingung | Aktion |
|---|---|---|
| Linke Hand an rechte Schulter | `dist2D(LM 15, LM 12) < 0.12` | `Reveal.right()` |
| Rechte Hand an linke Schulter | `dist2D(LM 16, LM 11) < 0.12` | `Reveal.left()` |
| Beide Hände an Kopf | `dist2D(LM 15, LM 0) < 0.25` **und** `dist2D(LM 16, LM 0) < 0.25` | `Reveal.up()` |
| Beide Hände an Hüfte | `dist2D(LM 15, LM 23) < 0.20` **und** `dist2D(LM 16, LM 24) < 0.20` | `Reveal.down()` |

Landmarks mit `visibility < 0.5` werden ignoriert. Erst wenn die Pose die volle Haltezeit durchgehalten hat und danach losgelassen wird, kann dieselbe Geste erneut auslösen (Phase `FIRED` bleibt bis zur Pose-Freigabe).

---

## Schwellenwerte

| Konstante | Wert | Einheit | Begründung |
|---|---|---|---|
| `PINCH_THRESHOLD` | 0.08 | normalisiert | ~51 px bei 640 px. Komfortabler Pinch ohne Fingerkuppen zu quetschen. |
| `PINCH_HOLD_MS` | 500 ms | Millisekunden | Lang genug um versehentliches Pinchen herauszufiltern, kurz genug für flüssige Bedienung. |
| `AXIS_LOCK_THRESHOLD` | 0.04 | normalisiert | ~26 px. Lock greift früh, bevor Diagonalbewegung die Richtung verfälscht. |
| `AXIS_RATIO` | 2.5 | Faktor | Dominante Achse muss 2,5× so groß sein wie die andere, damit der Lock greift. |
| `PINCH_MOVE_DELTA` | 0.13 | normalisiert | ~83 px akkumulierte Bewegung zum Auslösen. Etwas mehr als AXIS_LOCK_THRESHOLD × AXIS_RATIO. |
| `COOLDOWN_MS` | 700 ms | Millisekunden | Mindestpause zwischen zwei Aktionen. Verhindert Mehrfachauslösung. |
| `CONFIDENCE_MIN` | 0.70 | Score 0–1 | Handedness-Score-Schwellenwert. Unter 0.7 zu viel Rauschen. |
| `HAND_MIN_SCALE` | 0.10 | normalisiert | Handgelenk→Mittelfinger-Spitze. Unter diesem Wert gilt die Hand als zu weit entfernt. |
| `POSE_HOLD` | 700 ms | Millisekunden | Haltezeit für alle Fernbereichsposen vor dem Auslösen. |
| `SHOULDER_TAP_DIST` | 0.12 | normalisiert | Max. Abstand Handgelenk zu gegenüberliegender Schulter. |
| `HEAD_DIST` | 0.25 | normalisiert | Max. Abstand beider Handgelenke zur Nase. Großzügig, da Hände seitlich am Kopf. |
| `HIP_DIST` | 0.20 | normalisiert | Max. Abstand Handgelenk zu gleichseitiger Hüfte. |
| `VISIBILITY_MIN` | 0.50 | Score 0–1 | Pose-Landmark-Sichtbarkeitsschwelle. |

---

## Smoothing – One Euro Filter

Angewendet auf den Pinch-Mittelpunkt (Durchschnitt aus LM 4 und LM 8), separat für X- und Y-Achse pro Hand.

| Parameter | Wert | Bedeutung |
|---|---|---|
| `minCutoff` | 1.0 Hz | Glättung bei langsamer Bewegung. |
| `beta` | 0.05 | Reduziert Lag bei schnellen Bewegungen. |
| `dCutoff` | 1.0 Hz | Standard aus dem Paper. |

Die Parameter wurden durch manuelles Ausprobieren gefunden: verschiedene Werte testen, Verhalten beobachten, anpassen (kein formelles Experiment).

---

## False Positives

### Nahbereich (Pinch + Ziehen) – höheres Risiko

Im Nahbereich treten False Positives merklich häufiger auf als im Fernbereich, weil natürliche Handbewegungen (Gestikulieren, Greifen, Tippen) mit der Pinch-Geste kollidieren können:

- **Versehentlicher Pinch**: Finger kommen beim Gestikulieren zufällig nahe zusammen. Der `PINCH_HOLD_MS`-Puffer (500 ms) filtert kurze Berührungen heraus, eliminiert das Problem aber nicht vollständig.
- **Falsche Richtung nach Lock**: Wer die Hand diagonal bewegt, kann nach dem Axis-Lock in die falsche Richtung navigieren, wenn beide Achsen zum Lock-Zeitpunkt ähnlich groß sind.
- **Zwei Hände gleichzeitig**: Wenn beide Hände pinchen, gewinnt die erste in der Iterationsreihenfolge (Links zuerst). Das kann zu unerwartetem Verhalten führen.

Mitigation: `PINCH_HOLD_MS`, `AXIS_LOCK_THRESHOLD`, `AXIS_RATIO`, `COOLDOWN_MS`.

### Fernbereich (Körperposen) – geringes Risiko

Fernbereichsposen sind deutlich resistenter gegen False Positives, weil die gewählten Posen normalerweise im Alltag und beim Präsentieren nicht versehentlich eingenommen werden:

- **Schultergriff**: Man greift im natürlichen Stehen selten zur gegenüberliegenden Schulter. Kaum versehentlich.
- **Beide Hände am Kopf**: Erfordert beide Arme gleichzeitig gehoben. Kommt beim Präsentieren nicht vor.
- Einziges Risiko: Die Hände auf der Hüfte zu platzieren, gilt als eher natürliche Pose und kann somit versehentlich ausgelöst werden.

### Bekannte Stabilitätsprobleme

- **Schlechte Beleuchtung**
- **Teilweise verdeckte Landmarks**: Wenn Schulter oder Hüfte nicht sichtbar sind.
- **Moduswechsel-Grenze**: An der ~2-m-Grenze kann bei bestimmten Kamera-FOVs der Modus flackern, wenn eine Hand die Schwelle knapp über- und unterschreitet.

---

## Links

* [One Euro Filter Paper (Casiez et al. 2012)](https://inria.hal.science/hal-00670496)
* [MediaPipe Hand Landmarks](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
* [MediaPipe Pose Landmarks](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)
* [Reveal.js API](https://revealjs.com/api/)
