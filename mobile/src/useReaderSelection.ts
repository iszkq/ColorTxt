import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { verseNumber, verseRange, type TextSelection } from './bible';
import { characterAt, comparePoints, graphemes, textRange, type TextPoint } from './text-selection';

type Edge = 'start' | 'end';
type Props = { selection: TextSelection | null; immersive: boolean };

export function useReaderSelection(scroller: Ref<HTMLElement | undefined>, lines: Ref<string[]>, props: Props,
  select: (value: TextSelection | null) => void, immerse: () => void, drag: (value: boolean) => void) {
  const handles = ref<{ edge: Edge; x: number; y: number; height: number }[]>([]);
  const lens = ref<{ text: string; x: number; y: number } | null>(null);
  let anchor: number | null = null, timer: ReturnType<typeof setTimeout> | undefined;
  let origin = { x: 0, y: 0 }, moved = false, held = false, pointer: number | null = null;
  let activeEdge: Edge | null = null, dragElement: HTMLElement | null = null;
  let dragPoint = { x: 0, y: 0 }, grabY = 0, frame = 0, layoutFrame = 0;
  let dragStart: TextSelection | null = null;
  let mouseStart: TextPoint | null = null;
  let geometry = new WeakMap<HTMLElement, { text: string; width: number; height: number; glyphs: { offset: number; length: number; left: number; right: number; top: number; bottom: number }[] }>();
  const nativeClear = () => { window.getSelection()?.removeAllRanges(); };
  const sourceFor = (line: number) => scroller.value?.querySelector<HTMLElement>(`[data-line="${line}"] .source-text`);

  function domPoint(source: HTMLElement, offset: number) {
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    let node: Node | null, remaining = offset, last: Node = source;
    while ((node = walker.nextNode())) {
      last = node;
      if (remaining <= (node.textContent?.length ?? 0)) return { node, offset: remaining };
      remaining -= node.textContent?.length ?? 0;
    }
    return { node: last, offset: last.textContent?.length ?? 0 };
  }
  function glyphRect(source: HTMLElement, start: number, end: number) {
    const a = domPoint(source, start), b = domPoint(source, end);
    const range = document.createRange(); range.setStart(a.node, a.offset); range.setEnd(b.node, b.offset);
    return range.getClientRects()[0];
  }
  function pointAt(x: number, y: number): TextPoint | null {
    const sources = [...scroller.value?.querySelectorAll<HTMLElement>('.source-text') ?? []];
    const source = sources.reduce<HTMLElement | null>((best, el) => {
      const distance = (s: HTMLElement) => { const r = s.getBoundingClientRect(); return Math.max(r.top - y, y - r.bottom, 0); };
      return !best || distance(el) < distance(best) ? el : best;
    }, null);
    if (!source) return null;
    const row = source.closest<HTMLElement>('[data-line]')!;
    const text = source.textContent ?? '';
    // Measure graphemes instead of depending on native selection/caret APIs: WebViews
    // disagree about caret hit testing on user-select:none content and colored spans.
    const bounds = source.getBoundingClientRect();
    let measured = geometry.get(source);
    if (!measured || measured.text !== text || measured.width !== bounds.width || measured.height !== bounds.height) {
      measured = { text, width: bounds.width, height: bounds.height, glyphs: graphemes(text).flatMap(part => {
        const rect = glyphRect(source, part.index, part.index + part.segment.length);
        return rect?.height ? [{ offset: part.index, length: part.segment.length, left: rect.left - bounds.left, right: rect.right - bounds.left, top: rect.top - bounds.top, bottom: rect.bottom - bounds.top }] : [];
      }) };
      geometry.set(source, measured);
    }
    let best: { distance: number; offset: number } | null = null;
    const localX = x - bounds.left, localY = y - bounds.top;
    for (const rect of measured.glyphs) {
      const vertical = Math.max(rect.top - localY, localY - rect.bottom, 0);
      const horizontal = Math.max(rect.left - localX, localX - rect.right, 0);
      const distance = vertical * 1000 + horizontal;
      if (!best || distance < best.distance) best = { distance, offset: rect.offset + (localX > (rect.left + rect.right) / 2 ? rect.length : 0) };
    }
    return best ? { line: Number(row.dataset.line), column: Number(row.dataset.prefix ?? 0) + best.offset + 1 } : null;
  }
  function updateHandles() {
    const range = props.selection, container = scroller.value;
    if (!range || !container) { handles.value = []; return; }
    const bounds = container.getBoundingClientRect();
    handles.value = (['start', 'end'] as const).flatMap(edge => {
      const line = edge === 'start' ? range.startPhysicalLine : range.endPhysicalLine;
      const source = sourceFor(line); if (!source) return [];
      const prefix = Number(source.closest<HTMLElement>('[data-line]')!.dataset.prefix ?? 0);
      const offset = Math.max(0, (edge === 'start' ? range.startColumn : range.endColumn) - prefix - 1);
      const part = characterAt(source.textContent ?? '', edge === 'end' ? Math.max(0, offset - 1) : offset);
      if (!part) return [];
      const rect = glyphRect(source, part.start, part.end); if (!rect) return [];
      return [{ edge, x: (edge === 'start' ? rect.left : rect.right) - bounds.left, y: rect.top - bounds.top + container.scrollTop, height: rect.height }];
    });
  }
  function scheduleLayout() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(updateHandles); }
  function bounds() {
    const r = scroller.value!.getBoundingClientRect();
    const top = document.querySelector('.reader-header')?.getBoundingClientRect().bottom ?? r.top;
    const bottom = document.querySelector('.selection-tools')?.getBoundingClientRect().top ?? r.bottom;
    return { top: Math.max(r.top, top), bottom: Math.min(r.bottom, bottom) };
  }
  function moveHandle() {
    if (!activeEdge || !dragStart || !scroller.value) return;
    const area = bounds();
    const y = Math.max(area.top + 2, Math.min(area.bottom - 2, dragPoint.y - grabY));
    const point = pointAt(dragPoint.x, y); if (!point) return;
    const fixed = activeEdge === 'start' ? { line: dragStart.endPhysicalLine, column: dragStart.endColumn } : { line: dragStart.startPhysicalLine, column: dragStart.startColumn };
    if (comparePoints(point, fixed)) select(textRange(lines.value, point, fixed));
    const text = lines.value[point.line - 1];
    lens.value = { text: text.slice(Math.max(0, point.column - 7), point.column + 6), x: Math.max(90, Math.min(scroller.value.clientWidth - 90, dragPoint.x - scroller.value.getBoundingClientRect().left)), y: Math.max(area.top + 36, y - 52) - scroller.value.getBoundingClientRect().top + scroller.value.scrollTop };
    nativeClear();
  }
  function autoScroll() {
    if (!activeEdge || !scroller.value) return;
    const area = bounds(), y = dragPoint.y - grabY;
    const delta = y < area.top + 40 ? -Math.min(12, (area.top + 40 - y) / 3) : y > area.bottom - 40 ? Math.min(12, (y - area.bottom + 40) / 3) : 0;
    if (delta) { scroller.value.scrollTop += delta; moveHandle(); }
    frame = requestAnimationFrame(autoScroll);
  }
  function beginHandle(event: PointerEvent, edge: Edge) {
    if (!props.selection) return;
    event.preventDefault(); event.stopPropagation(); clearTimeout(timer);
    activeEdge = edge; pointer = event.pointerId; dragStart = { ...props.selection }; anchor = null; geometry = new WeakMap();
    dragElement = event.currentTarget as HTMLElement; dragElement.setPointerCapture(event.pointerId);
    const handle = handles.value.find(h => h.edge === edge)!;
    grabY = event.clientY - (scroller.value!.getBoundingClientRect().top + handle.y - scroller.value!.scrollTop + handle.height / 2);
    dragPoint = { x: event.clientX, y: event.clientY }; held = true; drag(true); autoScroll();
  }
  function selectVerse(line: number) {
    nativeClear();
    if (anchor === line && props.selection?.startPhysicalLine === props.selection?.endPhysicalLine) { anchor = null; select(null); return; }
    anchor ??= line;
    select(verseRange(lines.value, anchor, line));
  }
  function selectParagraph(line: number) {
    anchor = null; nativeClear();
    select(textRange(lines.value, { line, column: 1 }, { line, column: lines.value[line - 1].length + 1 }));
  }
  function pointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) { clearTimeout(timer); return; }
    geometry = new WeakMap(); mouseStart = null;
    pointer = event.pointerId; origin = { x: event.clientX, y: event.clientY }; moved = false; held = false;
    const source = (event.target as Element).closest('.source-text');
    if (!source) return;
    if (event.pointerType === 'mouse') mouseStart = pointAt(event.clientX, event.clientY);
    timer = setTimeout(() => {
      if (moved) return;
      held = true; nativeClear();
      const row = source.closest<HTMLElement>('[data-line]')!;
      if (verseNumber(lines.value[Number(row.dataset.line) - 1])) { anchor = null; selectVerse(Number(row.dataset.line)); }
      else {
        const point = pointAt(origin.x, origin.y); if (!point) return;
        const char = characterAt(lines.value[point.line - 1], point.column - 1);
        if (char) select(textRange(lines.value, { line: point.line, column: char.start + 1 }, { line: point.line, column: char.end + 1 }));
      }
    }, 380);
  }
  function pointerMove(event: PointerEvent) {
    if (event.pointerId !== pointer) return;
    if (activeEdge) { event.preventDefault(); dragPoint = { x: event.clientX, y: event.clientY }; moveHandle(); return; }
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) {
      moved = true; clearTimeout(timer);
      if (mouseStart) {
        const end = pointAt(event.clientX, event.clientY);
        const initial = end && textRange(lines.value, mouseStart, end);
        if (initial) {
          anchor = null; dragStart = { ...initial, startPhysicalLine: mouseStart.line, startColumn: mouseStart.column };
          activeEdge = 'end'; grabY = 0; held = true; mouseStart = null;
          dragPoint = { x: event.clientX, y: event.clientY }; drag(true); autoScroll(); moveHandle();
        }
      }
    }
  }
  function pointerUp(event: PointerEvent) {
    if (event.pointerId !== pointer) return;
    clearTimeout(timer); pointer = null; mouseStart = null;
    if (activeEdge) { if (dragElement?.hasPointerCapture(event.pointerId)) dragElement.releasePointerCapture(event.pointerId); dragElement = null; activeEdge = null; dragStart = null; drag(false); lens.value = null; cancelAnimationFrame(frame); }
  }
  function cancel(event: PointerEvent) { moved = true; pointerUp(event); }
  function click(event: MouseEvent) {
    const target = event.target as Element;
    if (target.closest('button')) return;
    if (moved || held) { event.preventDefault(); event.stopPropagation(); return; }
    if (props.selection) { anchor = null; select(null); nativeClear(); return; }
    if (target.closest('.source-text')) return;
    immerse();
  }
  function handleKey(event: KeyboardEvent, edge: Edge) {
    if (!props.selection || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const range = props.selection;
    let line = edge === 'start' ? range.startPhysicalLine : range.endPhysicalLine;
    let offset = (edge === 'start' ? range.startColumn : range.endColumn) - 1;
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const parts = graphemes(lines.value[line - 1]);
    offset = forward ? (parts.find(p => p.index > offset)?.index ?? lines.value[line - 1].length) : ([...parts].reverse().find(p => p.index < offset)?.index ?? 0);
    if (offset === (edge === 'start' ? range.startColumn : range.endColumn) - 1) {
      line += forward ? 1 : -1;
      if (!sourceFor(line)) return;
      offset = forward ? Number(sourceFor(line)!.closest<HTMLElement>('[data-line]')!.dataset.prefix ?? 0) : lines.value[line - 1].length;
    }
    const fixed = edge === 'start' ? { line: range.endPhysicalLine, column: range.endColumn } : { line: range.startPhysicalLine, column: range.startColumn };
    const point = { line, column: offset + 1 };
    // Keyboard handles retain their identity; stop at the opposite endpoint.
    if ((edge === 'start' && comparePoints(point, fixed) >= 0) || (edge === 'end' && comparePoints(point, fixed) <= 0)) return;
    anchor = null; select(textRange(lines.value, point, fixed));
  }
  function onScroll() { clearTimeout(timer); scheduleLayout(); }
  watch(() => props.selection, async value => { if (!value) anchor = null; nativeClear(); await nextTick(); updateHandles(); }, { deep: true });
  onMounted(() => {
    document.addEventListener('pointermove', pointerMove, { passive: false });
    document.addEventListener('pointerup', pointerUp); document.addEventListener('pointercancel', cancel);
    window.addEventListener('resize', scheduleLayout);
    scroller.value?.addEventListener('scroll', onScroll, { passive: true }); scheduleLayout();
  });
  onBeforeUnmount(() => {
    clearTimeout(timer); cancelAnimationFrame(frame); cancelAnimationFrame(layoutFrame);
    document.removeEventListener('pointermove', pointerMove); document.removeEventListener('pointerup', pointerUp); document.removeEventListener('pointercancel', cancel);
    window.removeEventListener('resize', scheduleLayout); scroller.value?.removeEventListener('scroll', onScroll);
  });
  return { handles, lens, pointerDown, click, selectVerse, selectParagraph, beginHandle, handleKey, held: () => held || moved };
}
