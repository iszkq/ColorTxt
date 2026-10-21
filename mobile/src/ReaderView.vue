<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { annotationColors, chapterAt, darkWordColors, segmentsForLine, wordColors, type Annotation, type Book, type Segment, type Settings } from './core';
import { verseNumber, type TextSelection } from './bible';
import { useReaderSelection } from './useReaderSelection';
import { horizontalPageDirection } from './reader-gestures';
const props = defineProps<{ book: Book; settings: Settings; target: { line: number; nonce: number }; selection: TextSelection | null; immersive: boolean }>();
const emit = defineEmits<{ progress: [line: number]; select: [selection: TextSelection | null]; inspect: [annotation: Annotation]; immerse: []; dragging: [value: boolean] }>();
const scroller = ref<HTMLElement>();
const lines = computed(() => props.book.content.split('\n'));
const { handles, lens, pointerDown, click, selectVerse, selectParagraph, beginHandle, handleKey, held } = useReaderSelection(scroller, lines, props, value => emit('select', value), () => emit('immerse'), value => emit('dragging', value));
let swipeStart: { x: number; y: number; time: number; pointerId: number } | null = null;
const start = ref(1), end = ref(1);
const isBible = computed(() => props.book.chapters.some(c => c.book && c.chapter));
const visible = computed(() => lines.value.slice(start.value-1, end.value).map((text,i) => {
  const verse = isBible.value ? verseNumber(text) : undefined;
  const prefix = verse ? verse.length + 1 : 0;
  const line = start.value+i;
  const selected = props.selection;
  const from = selected && line >= selected.startPhysicalLine && line <= selected.endPhysicalLine ? (line === selected.startPhysicalLine ? selected.startColumn - 1 : 0) : -1;
  const to = selected && from >= 0 ? (line === selected.endPhysicalLine ? selected.endColumn - 1 : text.length) : -1;
  return { text, verse, prefix, line,
    segments: segmentsForLine(text,start.value+i,props.book.annotations,props.book.keywords,props.settings.colorize)
      .filter(s => s.end > prefix).flatMap(s => {
        const points = [...new Set([Math.max(s.start, prefix), s.end, ...[from,to].filter(p => p > Math.max(s.start, prefix) && p < s.end)])].sort((a,b) => a-b);
        return points.slice(0,-1).map((a,i) => ({...s, start:a, end:points[i+1], text:text.slice(a,points[i+1]), selected:from >= 0 && a >= from && points[i+1] <= to}));
      }) };
}));
const currentChapter = computed(() => props.book.chapters[chapterAt(props.book.chapters, start.value)]);
function styleFor(segment: Segment) {
  const ann = segment.annotations.find(a => a.lineation);
  const color = ann ? annotationColors[Math.max(0,ann.lineation!.colorIndex) % annotationColors.length] : undefined;
  const foreground = typeof segment.color === 'number' ? (props.settings.theme === 'dark' ? darkWordColors : wordColors)[segment.color % wordColors.length] : undefined;
  return { color: foreground, '--annotation-color': color };
}
async function jump(line: number) {
  line = Math.max(1, Math.min(lines.value.length, line));
  const ci = chapterAt(props.book.chapters,line);
  const chapterStart = Math.min(props.book.chapters[ci]?.line ?? 1, line);
  const chapterEnd = (props.book.chapters[ci+1]?.line ?? lines.value.length+1)-1;
  const part = Math.floor((line-chapterStart)/120);
  start.value = chapterStart + part*120; end.value = Math.min(chapterEnd, start.value+119);
  emit('select',null); window.getSelection()?.removeAllRanges();
  await nextTick();
  const el = scroller.value?.querySelector<HTMLElement>(`[data-line="${line}"]`);
  if (scroller.value) {
    const containerTop = scroller.value.getBoundingClientRect().top;
    const readingTop = props.immersive ? containerTop : (document.querySelector('.reader-header')?.getBoundingClientRect().bottom ?? containerTop);
    scroller.value.scrollTop = el ? scroller.value.scrollTop + el.getBoundingClientRect().top - readingTop - 20 : 0;
  }
  emit('progress',line);
}
function previousPart() {
  const ci = chapterAt(props.book.chapters,start.value);
  const chapterStart = props.book.chapters[ci]?.line ?? 1;
  void jump(start.value > chapterStart ? Math.max(chapterStart,start.value-120) : (props.book.chapters[ci-1]?.line ?? 1));
}
function onPointerDown(event: PointerEvent) {
  pointerDown(event);
  const target = event.target instanceof Element ? event.target : null;
  if (!event.isPrimary || event.pointerType !== 'touch' || target?.closest('button,.selection-handle') || props.selection) {
    swipeStart = null;
    return;
  }
  swipeStart = { x: event.clientX, y: event.clientY, time: event.timeStamp, pointerId: event.pointerId };
}
function onPointerUp(event: PointerEvent) {
  const gesture = swipeStart;
  swipeStart = null;
  const container = scroller.value;
  if (!gesture || gesture.pointerId !== event.pointerId || !container || props.selection) return;
  const direction = horizontalPageDirection(event.clientX - gesture.x, event.clientY - gesture.y, event.timeStamp - gesture.time, container.clientWidth);
  if (!direction) return;
  const atStart = container.scrollTop <= 12;
  const atEnd = container.scrollTop + container.clientHeight >= container.scrollHeight - 24;
  if (direction > 0 && atEnd && end.value < lines.value.length) {
    void jump(end.value + 1);
    return;
  }
  if (direction < 0 && atStart && start.value > 1) {
    previousPart();
    return;
  }
  const targetTop = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + direction * container.clientHeight * 0.86));
  container.scrollTo({ top: targetTop, behavior: 'smooth' });
}
function onPointerCancel(event: PointerEvent) {
  if (swipeStart?.pointerId === event.pointerId) swipeStart = null;
}
let frame = 0;
function onScroll() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const container = scroller.value; if (!container) return;
    const top = props.immersive ? container.getBoundingClientRect().top : (document.querySelector('.reader-header')?.getBoundingClientRect().bottom ?? container.getBoundingClientRect().top);
    const row = [...container.querySelectorAll<HTMLElement>('[data-line]')].find(el => el.getBoundingClientRect().bottom > top+24);
    if (row) emit('progress',Number(row.dataset.line));
  });
}
function inspect(annotations: Annotation[]) {
  if (!annotations.length || props.selection || held()) return;
  emit('inspect', annotations[0]);
}
watch(() => props.target, value => void jump(value.line), { immediate:true });
onBeforeUnmount(() => cancelAnimationFrame(frame));
defineExpose({ jump });
</script>

<template>
  <div ref="scroller" class="reader-scroll" :class="{ serif: settings.serif, 'bible-reader': isBible }" :style="{ '--reading-size': settings.fontSize+'px', '--reading-leading': settings.lineHeight }" @scroll.passive="onScroll" @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="onPointerCancel" @click="click" @contextmenu.prevent @selectstart.prevent @dragstart.prevent>
    <article class="reader-article" aria-label="阅读正文">
      <div class="chapter-caption">{{ isBible ? currentChapter?.testament + ' · ' + currentChapter?.book : currentChapter?.title }}</div>
      <template v-if="isBible"><h1 class="bible-chapter-title">{{currentChapter?.book}} <span>第{{currentChapter?.chapter}}章</span></h1><p class="verse-hint">长按选经文 · 拖动手柄细选 · 轻点空白沉浸阅读</p></template>
      <template v-for="row in visible" :key="row.line">
        <p v-if="row.text.trim() && !(isBible && /^#{1,6}\s/.test(row.text))" :data-line="row.line" :data-prefix="row.prefix" :tabindex="!isBible ? 0 : undefined" :aria-keyshortcuts="!isBible ? 'Enter Space' : undefined" @keydown.self.enter.prevent="selectParagraph(row.line)" @keydown.self.space.prevent="selectParagraph(row.line)" :class="{ 'verse-row': row.verse, 'chapter-heading': !isBible && (/^#{1,6}\s/.test(row.text) || book.chapters.some(c => c.line === row.line)) }">
          <button v-if="row.verse" class="verse-number" :aria-label="`选择第${row.verse}节`" :aria-pressed="!!selection && selection.startPhysicalLine <= row.line && selection.endPhysicalLine >= row.line" @click="selectVerse(row.line)">{{row.verse}}</button><span class="source-text"><span v-for="segment in row.segments" :key="segment.start" :style="styleFor(segment)" :class="[{'selected-text':segment.selected}, segment.color === 'dialogue' ? 'dialogue' : segment.color === 'bracket' ? 'bracket' : '', ...segment.annotations.flatMap(a => [a.lineation?.type, a.note ? 'has-note' : ''])]" @click="inspect(segment.annotations)">{{ segment.text }}</span></span>
        </p>
        <div v-else-if="!row.text.trim()" class="paragraph-gap" :data-line="row.line"><br /></div>
      </template>
      <div class="chapter-pagination">
        <button :disabled="start === 1" @click="previousPart">{{isBible ? '上一章 / 段' : '上一段'}}</button>
        <span>{{ end === lines.length ? '全书完' : '本段读完了' }}</span>
        <button :disabled="end === lines.length" @click="jump(end+1)">继续阅读</button>
      </div>
    </article>
    <button v-for="handle in handles" :key="handle.edge" class="selection-handle" :class="'handle-'+handle.edge" :style="{left:handle.x+'px',top:handle.y+'px','--handle-height':handle.height+'px'}" :aria-label="handle.edge==='start'?'调整选区起点':'调整选区终点'" @pointerdown="beginHandle($event,handle.edge)" @keydown="handleKey($event,handle.edge)" @click.stop><span></span></button>
    <div v-if="lens" class="selection-lens" :style="{left:lens.x+'px',top:lens.y+'px'}" aria-hidden="true">{{lens.text}}</div>
  </div>
</template>
