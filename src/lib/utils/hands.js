// MediaPipe runs on a mirrored (selfie) video feed, so its "Left"/"Right"
// handedness labels are swapped relative to the user's actual hands.
export function mirrorHandedness(rawLabel) {
  return rawLabel === "Left" ? "Right" : "Left";
}

// Picks at most one landmark set per hand from a GestureRecognizer result,
// filtered by confidence and corrected for the mirrored handedness label.
// Returns { Left, Right } where each value is a landmark array or null.
export function selectHands(handResults, confidenceMin = 0.7) {
  const hands = { Left: null, Right: null };

  for (let i = 0; i < handResults.landmarks.length; i++) {
    const score = handResults.handednesses[i]?.[0]?.score ?? 0;
    if (score < confidenceMin) continue;

    const raw = handResults.handednesses[i][0].displayName;
    const label = mirrorHandedness(raw);
    hands[label] = handResults.landmarks[i];
  }

  return hands;
}
