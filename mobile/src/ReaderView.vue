<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { annotationColors, chapterAt, darkWordColors, segmentsForLine, wordColors, type Annotation, type Book, type Segment, type Settings } from './core';
const props = defineProps<{ book: Book; settings: Settings; target: { line: number; nonce: number } }>();
const emit = defineEmits<{ progress: [line: number]; select: [selection: Pick<Annotation, 'startPhysicalLine'|'endPhysicalLine'|'startColumn'|'endColumn'|'text'> | null]; inspect: [annotation: Annotation] }>();
const scroller = ref<HTMLElement>();
const lines = computed(() => props.book.content.split('\n'));
const start = ref(1), end = ref(1);
const visible = computed(() => lines.value.slice(start.value-1, end.value).map((text,i) => ({ text, line: start.value+i,
  segments: segmentsForLine(text,start.value+i,props.book.annotations,props.book.keywords,props.settings.colorize) })));
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
function endpoint(node: Node, offset: number) {
  const parent = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const paragraph = parent?.closest<HTMLElement>('[data-line]');
  if (!paragraph || !scroller.value?.contains(paragraph)) return null;
  const prefix = document.createRange(); prefix.selectNodeContents(paragraph); prefix.setEnd(node,offset);
  return { line: Number(paragraph.dataset.line), column: prefix.toString().length+1 };
}
function selectionChanged() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) { emit('select',null); return; }
  const range = selection.getRangeAt(0);
  const a = endpoint(range.startContainer,range.startOffset), b = endpoint(range.endContainer,range.endOffset);
  if (!a || !b) return;
  const text = lines.value.slice(a.line-1,b.line).map((line,i) => line.slice(i === 0 ? a.column-1 : 0, i === b.line-a.line ? b.column-1 : undefined)).join('\n');
  if (text.trim()) emit('select',{ startPhysicalLine:a.line,startColumn:a.column,endPhysicalLine:b.line,endColumn:b.column,text });
}
watch(() => props.target, value => void jump(value.line), { immediate:true });
onMounted(() => document.addEventListener('selectionchange',selectionChanged));
onBeforeUnmount(() => { cancelAnimationFrame(frame); document.removeEventListener('selectionchange',selectionChanged); });
defineExpose({ jump });
</script>

<template>
  <div ref="scroller" class="reader-scroll" :class="{ serif: settings.serif }" :style="{ '--reading-size': settings.fontSize+'px', '--reading-leading': settings.lineHeight }" @scroll.passive="onScroll">
    <article class="reader-article" aria-label="阅读正文">
      <div class="chapter-caption">{{ currentChapter?.title }}</div>
      <template v-for="row in visible" :key="row.line">
        <p v-if="row.text.trim()" :data-line="row.line" :class="{ 'chapter-heading': /^#{1,6}\s/.test(row.text) || book.chapters.some(c => c.line === row.line) }">
          <span v-for="segment in row.segments" :key="segment.start" :style="styleFor(segment)" :class="[segment.color === 'dialogue' ? 'dialogue' : segment.color === 'bracket' ? 'bracket' : '', ...segment.annotations.flatMap(a => [a.lineation?.type, a.note ? 'has-note' : ''])]" @click="segment.annotations.length && emit('inspect',segment.annotations[0])">{{ segment.text }}</span>
        </p>
        <div v-else class="paragraph-gap" :data-line="row.line"><br /></div>
      </template>
      <div class="chapter-pagination">
        <button :disabled="start === 1" @click="previousPart">上一段</button>
        <span>{{ end === lines.length ? '全书完' : '本段读完了' }}</span>
        <button :disabled="end === lines.length" @click="jump(end+1)">继续阅读</button>
      </div>
    </article>
  </div>
</template>
