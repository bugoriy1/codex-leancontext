export interface SafetyDecision {
  risk: 'normal' | 'elevated';
  minimumConfidence: number;
  forceExpansion: boolean;
  reasons: string[];
}

const elevatedPatterns: Array<[RegExp, string]> = [
  [/\bauth(?:entication|orization)?\b/i, 'authentication'],
  [/\bpermission/i, 'permissions'],
  [/\bsecret/i, 'secrets'],
  [/\bcrypt(?:ography|ographic)?\b/i, 'cryptography'],
  [/\b(?:database|schema)\s+migration\b/i, 'schema-migration'],
  [/\bpublic\s+api\b/i, 'public-api'],
  [/\bconcurrenc/i, 'concurrency'],
  [/\bdependency\s+upgrade\b/i, 'dependency-upgrade'],
];

export function assessContextSafety(task: string, confidence: number): SafetyDecision {
  const reasons = elevatedPatterns.filter(([pattern]) => pattern.test(task)).map(([, reason]) => reason);
  const risk = reasons.length > 0 ? 'elevated' : 'normal';
  const minimumConfidence = risk === 'elevated' ? 0.78 : 0.55;
  return {
    risk,
    minimumConfidence,
    forceExpansion: risk === 'elevated' || confidence < minimumConfidence,
    reasons: confidence < minimumConfidence ? [...reasons, 'low-confidence'] : reasons,
  };
}
