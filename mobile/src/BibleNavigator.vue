<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { ArrowLeft, ChevronRight, LocateFixed, Search, X } from 'lucide-vue-next';
import { chapterAt, type Chapter } from './core';
import { chapterVerses, verseNumber } from './bible';
const props = defineProps<{ chapters: Chapter[]; lines: string[]; line: number }>();
const emit = defineEmits<{ jump: [line: number] }>();
const current = computed(() => props.chapters[chapterAt(props.chapters, props.line)]);
const step = ref<'chapter'|'verse'>('chapter');
const testament = ref(current.value?.testament ?? '旧约');
const selectedBook = ref(current.value?.book ?? '');
const selectedChapter = ref<Chapter>();
const query = ref(''), precise = ref(false), heading = ref<HTMLElement>(), scroll = ref<HTMLElement>();
const books = computed(() => props.chapters.filter((c, i, all) => c.book && all.findIndex(x => x.book === c.book) === i));
const filteredBooks = computed(() => books.value.filter(c => query.value.trim() ? c.book!.includes(query.value.trim()) : c.testament === testament.value));
const chapters = computed(() => props.chapters.filter(c => c.book === selectedBook.value));
const verses = computed(() => selectedChapter.value ? chapterVerses(props.lines, props.chapters, selectedChapter.value) : []);
const currentVerse = computed(() => verseNumber(props.lines[props.line - 1] ?? ''));
function category(c: Chapter) {
  const index = books.value.filter(b => b.testament === c.testament).findIndex(b => b.book === c.book);
  return c.testament === '旧约' ? index < 5 ? '摩西五经' : index < 17 ? '历史书' : index < 22 ? '诗歌 · 智慧书' : index < 27 ? '大先知书' : '小先知书' : index < 4 ? '福音书' : index === 4 ? '历史书' : index < 26 ? '使徒书信' : '启示录';
}
const groups = computed(() => [...new Set(filteredBooks.value.map(category))].map(name => ({name,books:filteredBooks.value.filter(c => category(c) === name)})));
function chooseBook(c: Chapter) { selectedBook.value = c.book!; step.value = 'chapter'; selectedChapter.value=undefined; }
function chooseChapter(c: Chapter) { if (precise.value) { selectedChapter.value = c; step.value = 'verse'; } else emit('jump', c.line); }
function back() { if (step.value !== 'verse') return false; step.value = 'chapter'; return true; }
function switchTestament(value:string) { testament.value=value; query.value=''; const first=books.value.find(c => c.testament===value); if(first) selectedBook.value=first.book!; selectedChapter.value=undefined; step.value='chapter'; }
watch([step,selectedBook], async () => { await nextTick(); if (scroll.value) scroll.value.scrollTop = 0; heading.value?.focus({preventScroll:true}); });
onMounted(async () => { await nextTick(); document.querySelector('.book-index .chosen')?.scrollIntoView({block:'center'}); });
defineExpose({ back });
</script>

<template>
  <div class="bible-navigator">
    <button class="current-passage" @click="emit('jump', line)"><LocateFixed :size="18"/><span>正在读 · {{current?.book}} {{current?.chapter}}{{currentVerse ? ':' + currentVerse : '章'}}</span><span>返回原文</span></button>
    <label class="search-field bible-book-search"><Search :size="17"/><input v-model="query" placeholder="搜索书卷" aria-label="查找圣经书卷"/><button v-if="query" class="small-icon" aria-label="清空书卷搜索" @click="query=''"><X :size="17"/></button></label>
    <div class="testament-tabs" aria-label="旧约与新约"><button v-for="t in ['旧约','新约']" :key="t" :aria-pressed="testament === t && !query" :class="{active:testament === t && !query}" @click="switchTestament(t)">{{t}}<small>{{t === '旧约' ? '39' : '27'}} 卷</small></button></div>
    <div class="passage-columns">
      <nav class="book-index" aria-label="圣经书卷">
        <section v-for="group in groups" :key="group.name"><h4>{{group.name}}</h4><button v-for="c in group.books" :key="c.book" :class="{chosen:c.book===selectedBook}" :aria-current="c.book===selectedBook?'true':undefined" @click="chooseBook(c)"><span>{{c.book}}</span><i v-if="c.book===current?.book" aria-label="正在阅读"></i></button></section>
        <p v-if="!filteredBooks.length" class="empty-copy">没有匹配书卷</p>
      </nav>
      <section class="chapter-index" :aria-label="selectedBook+'章节'">
        <div class="index-heading"><button v-if="step==='verse'" class="small-icon" aria-label="返回上一级选经" @click="back"><ArrowLeft :size="18"/></button><div><h3 ref="heading" tabindex="-1">{{selectedBook}}</h3><p>{{step==='verse'?'第'+selectedChapter?.chapter+'章 · 选择节':chapters.length+' 章 · 选择章'}}</p></div></div>
        <div ref="scroll" class="passage-grid-scroll">
          <div v-if="step!=='verse'" class="number-grid"><button v-for="c in chapters" :key="c.line" :aria-label="`${selectedBook} 第${c.chapter}章`" :class="{active:c.line === current?.line}" :aria-current="c.line === current?.line ? 'true' : undefined" @click="chooseChapter(c)">{{c.chapter}}</button></div>
          <div v-else class="number-grid"><button v-for="v in verses" :key="v.line" :aria-label="`${selectedBook} ${selectedChapter?.chapter}章 第${v.number}节`" :class="{active:v.line === line}" @click="emit('jump',v.line)">{{v.number}}</button></div>
        </div>
        <label v-if="step!=='verse'" class="verse-option"><input v-model="precise" type="checkbox"/><span>精确到节</span></label>
        <button v-else class="read-chapter" @click="emit('jump',selectedChapter!.line)">从章首阅读<ChevronRight :size="15"/></button>
      </section>
    </div>
    <div class="passage-footer">{{step==='verse'?'点节数，定位到经文':precise?'选章后可继续选节':'选书卷 · 点章数开始阅读'}}</div>
  </div>
</template>
