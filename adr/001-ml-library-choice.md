# Gesture Recognition Library

* Status: accepted
* Deciders: Cosima Zink
* Issue: [1](https://github.com/mi-classroom/mi-web-technologien-beiboot-ss2026-cosimazink/issues/1)
* Date: 2026-05-07

## Context and Problem Statement

Für die kamerabasierte Gestenerkennung im Browser wird eine Library benötigt, die Handbewegungen in Echtzeit erkennt und verarbeitbare Rohdaten liefert.

## Considered Options

* MediaPipe Gesture Recognizer
* TensorFlow.js + Fingerpose
* Handsfree.js

## Decision Outcome

Gewählt wurde MediaPipe Gesture Recognizer. Die Library liefert 21 Hand-Landmarks pro Hand in 3D-Koordinaten, unterscheidet linke und rechte Hand und trackt beide Hände gleichzeitig. Sie wird aktiv von Google gepflegt, ist per CDN ohne Build-Schritt einbindbar und entspricht damit dem KISS-Prinzip des Projekts.

### Positive Consequences

* 21 Landmarks pro Hand mit x, y, z-Koordinaten
* Linke und rechte Hand werden unterschieden
* Kein Build-Step, direkt per CDN einbindbar
* Aktiv gepflegt, kommerziell gestützt (Google)

### Negative Consequences

* 8 eingebaute Gesten, darüber hinausgehende Gesten erfordern eigenes Training
* WASM-Bundle erhöht initiale Ladezeit

## Pros and Cons of the Options

### MediaPipe Gesture Recognizer

* Gut, weil 21 Landmarks pro Hand in Echtzeit
* Gut, weil 3D-Koordinaten (x, y, z) pro Punkt
* Gut, weil linke und rechte Hand werden unterschieden
* Gut, weil beide Hände gleichzeitig trackbar
* Gut, weil aktiv gepflegt von Google
* Gut, weil kein Build-Step nötig
* Schlecht, weil WASM-Bundle erhöht initiale Ladezeit
* Schlecht, weil eigene Gesten über die 8 eingebauten hinaus Training erfordern

### TensorFlow.js hand-pose-detection + Fingerpose

* Gut, weil eigene Gesten flexibel definierbar
* Gut, weil gutes Debugging
* Schlecht, weil deutlich mehr Implementierungsaufwand
* Schlecht, weil nicht aktiv gepflegt
* Schlecht, weil zwei separate Libraries kombiniert werden müssen
* Schlecht, weil nur Community-Support

### Handsfree.js

* Gut, weil Hand-, Gesichts- und Pose-Tracking in einer Library
* Gut, weil einfache API
* Gut, weil 24+ Pinch-Events verfügbar
* Schlecht, weil nur Community-Support
* Schlecht, weil für Prototyping ausgelegt, nicht für produktiven Einsatz

## Links

* [MediaPipe Gesture Recognizer Dokumentation](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js),
[Demo](https://google-ai-edge.github.io/mediapipe-samples-web/#/vision/hand_landmarker)
* [TensorFlow.js](https://github.com/tensorflow/tfjs-models/tree/master/hand-pose-detection), [Demo](https://storage.googleapis.com/tfjs-models/demos/hand-pose-detection/index.html?model=mediapipe_hands)
* [Handsfree.js](https://handsfreejs.netlify.app/#installing)
* [Best Gesture Recognition Libraries in JavaScript](https://portalzine.de/best-gesture-recognition-libraries-in-javascript-2025/)