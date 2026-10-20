<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ArrowLeft, ChevronRight, LocateFixed, Search } from 'lucide-vue-next';
import { chapterAt, type Chapter } from './core';
import { chapterVerses, verseNumber } from './bible';
const props = defineProps<{ chapters: Chapter[]; lines: string[]; line: number }>();
const emit = defineEmits<{ jump: [line: number] }>();
const current = computed(() => props.chapters[chapterAt(props.chapters, props.line)]);
const step = ref<'book'|'chapter'|'verse'>('book');
const testament = ref(current.value?.testament ?? '旧约');
const selectedBook = ref(current.value?.book ?? '');
const selectedChapter = ref<Chapter>();
const query = ref(''), precise = ref(false), heading = ref<HTMLElement>(), scroll = ref<HTMLElement>();
const books = computed(() => props.chapters.filter((c, i, all) => c.book && all.findIndex(x => x.book === c.book) === i));
const filteredBooks = computed(() => books.value.filter(c => query.value.trim() ? c.book!.includes(query.value.trim()) : c.testament === testament.value));
const chapters = computed(() => props.chapters.filter(c => c.book === selectedBook.value));
const verses = computed(() => selectedChapter.value ? chapterVerses(props.lines, props.chapters, selectedChapter.value) : []);
const currentVerse = computed(() => verseNumber(props.lines[props.line - 1] ?? ''));
function chooseBook(c: Chapter) { selectedBook.value = c.book!; step.value = 'chapter'; }
function chooseChapter(c: Chapter) { if (precise.value) { selectedChapter.value = c; step.value = 'verse'; } else emit('jump', c.line); }
function back() { if (step.value === 'book') return false; step.value = step.value === 'verse' ? 'chapter' : 'book'; return true; }
watch(step, async () => { await nextTick(); if (scroll.value) scroll.value.scrollTop = 0; heading.value?.focus(); });
defineExpose({ back });
</script>

<template>
  <div class="bible-navigator">
    <button class="current-passage" @click="emit('jump', line)"><LocateFixed :size="18"/><span>正在读 · {{current?.book}} {{current?.chapter}}{{currentVerse ? ':' + currentVerse : '章'}}</span><span>返回原文</span></button>
    <div class="passage-path">
      <button v-if="step !== 'book'" class="small-icon" aria-label="返回上一级选经" @click="back"><ArrowLeft :size="20"/></button>
      <h3 ref="heading" tabindex="-1"><template v-if="step === 'book'">选择书卷</template><template v-else>{{selectedBook}}<span v-if="step === 'verse'"> · 第{{selectedChapter?.chapter}}章</span></template></h3>
      <small>{{step === 'book' ? '卷' : step === 'chapter' ? '章' : '节'}}</small>
    </div>
    <template v-if="step === 'book'">
      <label class="search-field"><Search :size="18"/><input v-model="query" placeholder="查找书卷，如：约翰" aria-label="查找圣经书卷"/></label>
      <div class="testament-tabs" aria-label="旧约与新约"><button v-for="t in ['旧约','新约']" :key="t" :aria-pressed="testament === t && !query" :class="{active:testament === t && !query}" @click="testament=t;query=''">{{t}}<small>{{t === '旧约' ? '39' : '27'}} 卷</small></button></div>
    </template>
    <label v-if="step === 'chapter'" class="verse-option"><span>精确到节<small>开启后，选章再选节</small></span><input v-model="precise" type="checkbox" role="switch"/></label>
    <div ref="scroll" class="passage-grid-scroll">
      <div v-if="step === 'book'" class="book-grid"><button v-for="c in filteredBooks" :key="c.book" :class="{active:c.book === current?.book}" :aria-current="c.book === current?.book ? 'true' : undefined" @click="chooseBook(c)"><span>{{c.book}}</span><ChevronRight :size="14"/></button></div>
      <p v-if="step === 'book' && !filteredBooks.length" class="empty-copy">没有找到书卷，请试试完整卷名中的几个字。</p>
      <div v-if="step === 'chapter'" class="number-grid"><button v-for="c in chapters" :key="c.line" :aria-label="`${selectedBook} 第${c.chapter}章`" :class="{active:c.line === current?.line}" :aria-current="c.line === current?.line ? 'true' : undefined" @click="chooseChapter(c)">{{c.chapter}}</button></div>
      <div v-if="step === 'verse'" class="number-grid"><button v-for="v in verses" :key="v.line" :aria-label="`${selectedBook} ${selectedChapter?.chapter}章 第${v.number}节`" :class="{active:v.line === line}" @click="emit('jump',v.line)">{{v.number}}</button></div>
    </div>
    <div class="passage-footer"><template v-if="step === 'book'">按圣经顺序排列 · 66 卷</template><template v-else-if="step === 'chapter'">{{chapters.length}} 章 · {{precise ? '点章数，继续选节' : '点章数，开始阅读'}}</template><button v-else class="text-button" @click="emit('jump',selectedChapter!.line)">从本章开头阅读 <ChevronRight :size="16"/></button></div>
  </div>
</template>
