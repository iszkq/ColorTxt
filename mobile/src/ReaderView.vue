<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { annotationColors, chapterAt, darkWordColors, segmentsForLine, wordColors, type Annotation, type Book, type Segment, type Settings } from './core';
import { verseNumber, verseRange, type TextSelection } from './bible';
const props = defineProps<{ book: Book; settings: Settings; target: { line: number; nonce: number }; selection: TextSelection | null }>();
const emit = defineEmits<{ progress: [line: number]; select: [selection: Pick<Annotation, 'startPhysicalLine'|'endPhysicalLine'|'startColumn'|'endColumn'|'text'> | null]; inspect: [annotation: Annotation] }>();
const scroller = ref<HTMLElement>();
const lines = computed(() => props.book.content.split('\n'));
const start = ref(1), end = ref(1);
const isBible = computed(() => props.book.chapters.some(c => c.book && c.chapter));
const visible = computed(() => lines.value.slice(start.value-1, end.value).map((text,i) => {
  const verse = isBible.value ? verseNumber(text) : undefined;
  const prefix = verse ? verse.length + 1 : 0;
  return { text, verse, prefix, line: start.value+i,
    segments: segmentsForLine(text,start.value+i,props.book.annotations,props.book.keywords,props.settings.colorize)
      .filter(s => s.end > prefix).map(s => ({...s, text: text.slice(Math.max(s.start, prefix), s.end)})) };
}));
const currentChapter = computed(() => props.book.chapters[chapterAt(props.book.chapters, start.value)]);
function styleFor(segment: Segment) {
  const ann = segment.annotations.find(a => a.lineation);
  const color = ann ? annotationColors[Math.max(0,ann.lineation!.colorIndex) % annotationColors.length] : undefined;
  const foreground = typeof segment.color === 'number' ? (props.settings.theme === 'dark' ? darkWordColors : wordColors)[segment.color % wordColors.length] : undefined;
  return { color: foreground, '--annotation-color': color };
}
async function jump(line: number) {
  clearTimeout(selectionTimer); verseAnchor = null;
  line = Math.max(1, Math.min(lines.value.length, line));
  const ci = chapterAt(props.book.chapters,line);
  const chapterStart = Math.min(props.book.chapters[ci]?.line ?? 1, line);
  const chapterEnd = (props.book.chapters[ci+1]?.line ?? lines.value.length+1)-1;
  const part = Math.floor((line-chapterStart)/120);
  start.value = chapterStart + part*120; end.value = Math.min(chapterEnd, start.value+119);
  emit('select',null); window.getSelection()?.removeAllRanges();
  await nextTick();
  const el = scroller.value?.querySelector<HTMLElement>(`[data-line="${line}"]`);
  if (scroller.value) scroller.value.scrollTop = el ? el.offsetTop-scroller.value.offsetTop-20 : 0;
  emit('progress',line);
}
function previousPart() {
  const ci = chapterAt(props.book.chapters,start.value);
  const chapterStart = props.book.chapters[ci]?.line ?? 1;
  void jump(start.value > chapterStart ? Math.max(chapterStart,start.value-120) : (props.book.chapters[ci-1]?.line ?? 1));
}
let frame = 0;
function onScroll() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const container = scroller.value; if (!container) return;
    const top = container.getBoundingClientRect().top;
    const row = [...container.querySelectorAll<HTMLElement>('[data-line]')].find(el => el.getBoundingClientRect().bottom > top+24);
    if (row) emit('progress',Number(row.dataset.line));
  });
}
function endpoint(node: Node, offset: number, edge: 'start'|'end') {
  const container = scroller.value;
  if (!container?.contains(node)) return null;
  const parent = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  let source = parent?.closest<HTMLElement>('.source-text');
  let length = 0;
  if (source) {
    const prefix = document.createRange(); prefix.selectNodeContents(source); prefix.setEnd(node,offset);
    length = prefix.toString().length;
  } else {
    // Native selection handles can land between paragraphs or beside the verse button.
    const sources = [...container.querySelectorAll<HTMLElement>('.source-text')];
    if (edge === 'end') sources.reverse();
    source = sources.find(el => {
      const content = document.createRange(); content.selectNodeContents(el);
      return content.comparePoint(node, offset) === (edge === 'start' ? -1 : 1);
    });
    length = edge === 'end' ? source?.textContent?.length ?? 0 : 0;
  }
  const paragraph = source?.closest<HTMLElement>('[data-line]');
  if (!paragraph) return null;
  return { line: Number(paragraph.dataset.line), column: Number(paragraph.dataset.prefix ?? 0)+length+1 };
}
let selectionTimer: ReturnType<typeof setTimeout> | undefined, verseAnchor: number | null = null;
let touching = false, pointerStarted = 0, pointerX = 0, pointerY = 0, moved = false, toolbarInteraction = false;
function readSelection() {
  if (toolbarInteraction) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) { if (verseAnchor === null) emit('select',null); return; }
  const range = selection.getRangeAt(0);
  const a = endpoint(range.startContainer,range.startOffset,'start'), b = endpoint(range.endContainer,range.endOffset,'end');
  if (!a || !b) return;
  if (a.line > b.line || (a.line === b.line && a.column >= b.column)) return;
  const text = lines.value.slice(a.line-1,b.line).map((line,i) => line.slice(i === 0 ? a.column-1 : 0, i === b.line-a.line ? b.column-1 : undefined)).join('\n');
  if (text.trim()) { verseAnchor = null; emit('select',{ startPhysicalLine:a.line,startColumn:a.column,endPhysicalLine:b.line,endColumn:b.column,text }); }
}
function selectionChanged() { clearTimeout(selectionTimer); if (!touching) selectionTimer = setTimeout(readSelection, 180); }
function trackToolbar(event: PointerEvent) { toolbarInteraction = !!(event.target as Element).closest('.selection-tools'); }
function pointerDown(event: PointerEvent) { touching = true; pointerStarted = Date.now(); pointerX = event.clientX; pointerY = event.clientY; moved = false; }
function pointerMove(event: PointerEvent) { if (Math.hypot(event.clientX-pointerX,event.clientY-pointerY)>8) moved = true; }
function pointerUp() { touching = false; selectionChanged(); }
function inspect(annotations: Annotation[]) {
  if (!annotations.length || props.selection || moved || Date.now()-pointerStarted > 400 || !window.getSelection()?.isCollapsed) return;
  emit('inspect', annotations[0]);
}
async function selectVerse(line: number) {
  window.getSelection()?.removeAllRanges();
  if (props.selection && verseAnchor === line && props.selection.startPhysicalLine === props.selection.endPhysicalLine) { verseAnchor = null; emit('select',null); return; }
  verseAnchor ??= line;
  emit('select', verseRange(lines.value, verseAnchor, line));
  await nextTick();
  const row = scroller.value?.querySelector<HTMLElement>(`[data-line="${line}"]`);
  if (row && scroller.value && row.getBoundingClientRect().bottom > scroller.value.getBoundingClientRect().bottom) row.scrollIntoView({block:'nearest'});
}
watch(() => props.selection, value => {
  if (!value) verseAnchor = null;
  else if (value.startColumn === 1 && verseNumber(lines.value[value.startPhysicalLine - 1] ?? '')) verseAnchor ??= value.startPhysicalLine;
});
watch(() => props.target, value => void jump(value.line), { immediate:true });
onMounted(() => { document.addEventListener('pointerdown',trackToolbar, true); document.addEventListener('selectionchange',selectionChanged); document.addEventListener('pointerup',pointerUp); document.addEventListener('pointercancel',pointerUp); });
onBeforeUnmount(() => { clearTimeout(selectionTimer); cancelAnimationFrame(frame); document.removeEventListener('pointerdown',trackToolbar, true); document.removeEventListener('selectionchange',selectionChanged); document.removeEventListener('pointerup',pointerUp); document.removeEventListener('pointercancel',pointerUp); });
defineExpose({ jump });
</script>

<template>
  <div ref="scroller" class="reader-scroll" :class="{ serif: settings.serif, 'bible-reader': isBible }" :style="{ '--reading-size': settings.fontSize+'px', '--reading-leading': settings.lineHeight }" @scroll.passive="onScroll" @pointerdown="pointerDown" @pointermove="pointerMove">
    <article class="reader-article" aria-label="阅读正文">
      <div class="chapter-caption">{{ isBible ? currentChapter?.testament + ' · ' + currentChapter?.book : currentChapter?.title }}</div>
      <template v-if="isBible"><h1 class="bible-chapter-title">{{currentChapter?.book}} <span>第{{currentChapter?.chapter}}章</span></h1><p class="verse-hint">点节号选经文 · 长按文字自由选取</p></template>
      <template v-for="row in visible" :key="row.line">
        <p v-if="row.text.trim() && !(isBible && /^#{1,6}\s/.test(row.text))" :data-line="row.line" :data-prefix="row.prefix" :class="{ 'verse-row': row.verse, 'verse-selected': row.verse && selection && selection.startPhysicalLine <= row.line && selection.endPhysicalLine >= row.line, 'chapter-heading': !isBible && (/^#{1,6}\s/.test(row.text) || book.chapters.some(c => c.line === row.line)) }">
          <button v-if="row.verse" class="verse-number" :aria-label="`选择第${row.verse}节`" :aria-pressed="!!selection && selection.startPhysicalLine <= row.line && selection.endPhysicalLine >= row.line" @click="selectVerse(row.line)">{{row.verse}}</button><span class="source-text"><span v-for="segment in row.segments" :key="segment.start" :style="styleFor(segment)" :class="[segment.color === 'dialogue' ? 'dialogue' : segment.color === 'bracket' ? 'bracket' : '', ...segment.annotations.flatMap(a => [a.lineation?.type, a.note ? 'has-note' : ''])]" @click="inspect(segment.annotations)">{{ segment.text }}</span></span>
        </p>
        <div v-else-if="!row.text.trim()" class="paragraph-gap" :data-line="row.line"><br /></div>
      </template>
      <div class="chapter-pagination">
        <button :disabled="start === 1" @click="previousPart">{{isBible ? '上一章 / 段' : '上一段'}}</button>
        <span>{{ end === lines.length ? '全书完' : '本段读完了' }}</span>
        <button :disabled="end === lines.length" @click="jump(end+1)">继续阅读</button>
      </div>
    </article>
  </div>
</template>
