export function horizontalPageDirection(deltaX: number, deltaY: number, duration: number, viewportWidth: number): -1 | 1 | null {
  const distance = Math.abs(deltaX);
  const elapsed = Math.max(1, duration);
  const deliberate = distance >= 56 && (distance / elapsed >= 0.18 || distance >= viewportWidth * 0.22);
  if (!deliberate || distance <= Math.abs(deltaY) * 1.25) return null;
  return deltaX < 0 ? 1 : -1;
}
