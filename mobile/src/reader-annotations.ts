import type { Annotation } from './core';

export type AnnotationRange = Pick<Annotation, 'startPhysicalLine' | 'startColumn' | 'endPhysicalLine' | 'endColumn' | 'text'>;
export type Lineation = NonNullable<Annotation['lineation']>;

function comparePoint(lineA: number, columnA: number, lineB: number, columnB: number) {
  return lineA === lineB ? columnA - columnB : lineA - lineB;
}

export function rangesOverlap(a: AnnotationRange, b: AnnotationRange) {
  return comparePoint(a.startPhysicalLine, a.startColumn, b.endPhysicalLine, b.endColumn) < 0 &&
    comparePoint(b.startPhysicalLine, b.startColumn, a.endPhysicalLine, a.endColumn) < 0;
}

export function lineationsForRange(annotations: Annotation[], range: AnnotationRange) {
  return annotations.filter(annotation => annotation.lineation && rangesOverlap(annotation, range));
}

export function updateLineation(
  annotations: Annotation[],
  range: AnnotationRange,
  lineation: Lineation | null,
  now = Date.now(),
  createId: () => string = () => crypto.randomUUID(),
) {
  const overlapping = lineationsForRange(annotations, range);
  if (!lineation && !overlapping.length) return annotations;

  if (overlapping.length) {
    const ids = new Set(overlapping.map(annotation => annotation.id));
    return annotations.flatMap(annotation => {
      if (!ids.has(annotation.id)) return [annotation];
      if (!lineation && !annotation.note) return [];
      const updated = { ...annotation, updatedAt: now };
      if (lineation) updated.lineation = { ...lineation };
      else delete updated.lineation;
      return [updated];
    });
  }

  const noteOnSameRange = annotations.find(annotation =>
    !annotation.lineation &&
    annotation.startPhysicalLine === range.startPhysicalLine &&
    annotation.startColumn === range.startColumn &&
    annotation.endPhysicalLine === range.endPhysicalLine &&
    annotation.endColumn === range.endColumn,
  );
  if (noteOnSameRange) {
    return annotations.map(annotation => annotation.id === noteOnSameRange.id
      ? { ...annotation, lineation: { ...lineation! }, updatedAt: now }
      : annotation);
  }

  return [...annotations, {
    ...range,
    id: createId(),
    lineation: { ...lineation! },
    createdAt: now,
    updatedAt: now,
  }];
}
