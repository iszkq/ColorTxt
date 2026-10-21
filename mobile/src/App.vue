<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { BookOpen, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, FileText, FolderOpen, Highlighter, List, LoaderCircle, Maximize, Minimize, Minus, Moon, Palette, PencilLine, Plus, Search, Share2, Settings2, Sun, Trash2, Type, Underline, Waves, X } from 'lucide-vue-next';
import ReaderView from './ReaderView.vue';
import BibleNavigator from './BibleNavigator.vue';
import { passageLabel } from './bible';
import { annotationColors, annotationJson, chapterAt, defaultSettings, notesMarkdown, validAnnotations, wordColors, type Annotation, type Book, type Settings } from './core';
import { lineationsForRange, updateLineation } from './reader-annotations';
import * as storage from './storage';
import { copyText, exportText, importBook, shareText } from './platform';
import { seedBuiltinBooks } from './builtin';
import { setReadingMode } from './reading-mode';
import { previewScene } from './preview-scenes';
const previewParams = new URLSearchParams(location.search);
const isPreview = previewParams.has('preview') && !Capacitor.isNativePlatform();
const saveBook = (book: Book) => isPreview ? Promise.resolve() : storage.saveBook(book);
const removeBook = (id: string) => isPreview ? Promise.resolve() : storage.removeBook(id);
const saveSettings = (value: Settings) => isPreview ? Promise.resolve() : storage.saveSettings(value);
type Selection = Pick<Annotation,'startPhysicalLine'|'endPhysicalLine'|'startColumn'|'endColumn'|'text'>;
const books = ref<Book[]>([]), settings = ref<Settings>({...defaultSettings});
const ready = ref(false), busy = ref(false), error = ref(''), notice = ref('');
const tab = ref<'books'|'notes'|'settings'>('books');
const currentId = ref<string|null>(null), panel = ref<'chapters'|'notes'|'appearance'|'search'|'keywords'|null>(null);
const selection = ref<Selection|null>(null), draftSelection = ref<Selection|null>(null), draftNote = ref(''), editingNote = ref<Annotation|null>(null), showNote = ref(false);
const pendingDelete = ref<Book|null>(null), pendingRemoveNote = ref<Annotation|null>(null);
const showImport = ref(false);
const immersive = ref(false), draggingSelection = ref(false), showMarkOptions = ref(false);
const markType = ref<'marker'|'wavy'|'straight'>('marker');
const colorIndex = ref(2), query = ref(''), libraryQuery = ref(''), chapterQuery = ref('');
const selectedVolume = ref(''), target = ref({line:1,nonce:0});
const fileInput = ref<HTMLInputElement>(), noteInput = ref<HTMLTextAreaElement>();
const bibleNavigator = ref<InstanceType<typeof BibleNavigator>>();
const book = computed(() => books.value.find(b => b.id === currentId.value));
const currentLines = computed(() => book.value?.content.split('\n') ?? []);
const library = computed(() => books.value.filter(b => b.title.includes(libraryQuery.value)).sort((a,b) => b.lastOpened-a.lastOpened));
const allNotes = computed(() => books.value.flatMap(b => b.annotations.map(a => ({ book:b, annotation:a }))).sort((a,b) => b.annotation.updatedAt-a.annotation.updatedAt));
const chapters = computed(() => book.value?.chapters ?? []);
const volumes = computed(() => [...new Set(chapters.value.map(c => c.book).filter((b): b is string => !!b))]);
const visibleChapters = computed(() => chapters.value.filter(c => (!selectedVolume.value || c.book === selectedVolume.value) && c.title.includes(chapterQuery.value)));
const currentChapter = computed(() => book.value ? chapters.value[chapterAt(chapters.value,book.value.line)] : undefined);
const isBible = computed(() => volumes.value.length > 0);
const selectedReference = computed(() => selection.value ? passageLabel(currentLines.value,chapters.value,selection.value) : '');
const selectedLineations = computed(() => selection.value && book.value ? lineationsForRange(book.value.annotations,selection.value) : []);
const selectedLineation = computed(() => selectedLineations.value[0]?.lineation);
const chapterIndex = computed(() => book.value ? chapterAt(chapters.value,book.value.line) : 0);
const progress = computed(() => book.value ? Math.round((book.value.line-1)/Math.max(1,currentLines.value.length-1)*100) : 0);
const searchResults = computed(() => {
  const term = query.value.trim(); if (!term || !book.value) return [];
  const results: {line:number;text:string}[] = [];
  const lines = book.value.content.split('\n');
  for (let i=0; i<lines.length && results.length<100; i++) {
    const at = lines[i].indexOf(term); if (at>=0) results.push({line:i+1,text:lines[i].slice(Math.max(0,at-30),at+term.length+70)});
  } return results;
});
let bookTimer: ReturnType<typeof setTimeout>|undefined, noticeTimer: ReturnType<typeof setTimeout>|undefined;
let dirty: Book|undefined;
function fail(e: unknown) { error.value = e instanceof Error ? e.message : '操作失败，请重试。'; }
function toast(text: string) { notice.value=text; clearTimeout(noticeTimer); noticeTimer=setTimeout(() => notice.value='',2600); }
function queueSave(b = book.value) {
  if (!b) return;
  // A pending write belongs to its book even if the user switches to another one.
  if (dirty && dirty.id !== b.id) void flush();
  dirty=b; clearTimeout(bookTimer); bookTimer=setTimeout(() => void flush(),300);
}
async function flush() { clearTimeout(bookTimer); const b=dirty; dirty=undefined; if(b) { try { await saveBook(b); } catch(e) { dirty=b; fail(e); } } }
async function initialize() {
  error.value=''; busy.value=true;
  try {
    if (isPreview) {
      books.value=await (await import('./preview-data')).createPreviewBooks();
      const theme = previewParams.get('theme');
      settings.value={...defaultSettings, theme:theme==='dark'||theme==='light'?theme:'paper'};
    } else {
      books.value=await storage.loadBooks(); settings.value={...defaultSettings,...await storage.loadSettings()};
      await seedBuiltinBooks(books.value, saveBook);
    }
    ready.value=true;
    if (isPreview) await applyPreviewScene();
  } catch(e) { fail(e); } finally { busy.value=false; }
}
async function applyPreviewScene() {
  const scene=previewScene(previewParams.get('preview')).id;
  if (scene==='notes') { tab.value='notes'; return; }
  if (scene==='settings') { tab.value='settings'; return; }
  if (scene==='empty-notes') { for (const b of books.value) b.annotations=[]; tab.value='notes'; return; }
  if (scene==='books') return;
  if (scene==='import') { showImport.value=true; return; }
  if (scene==='delete') { pendingDelete.value=books.value[1]; return; }
  if (scene==='error') { error.value='这个文件暂时无法打开。请确认文件完整，并选择 TXT、Markdown 或未加密的 CTZ 文件后重试。'; return; }
  const sample=books.value[0];
  openBook(sample);
  await nextTick(); await nextTick();
  if (scene==='selection') selection.value={...sample.annotations[1]};
  else if (scene==='immersive') immersive.value=true;
  else if (scene==='note-editor') startNote(sample.annotations[0]);
  else if (scene==='book-notes') openPanel('notes');
  else if (scene==='search') { query.value='光'; openPanel('search'); }
  else if (scene==='chapters'||scene==='keywords'||scene==='appearance') openPanel(scene);
}
function openBook(b:Book, line = b.line) { void flush(); immersive.value=false; currentId.value=b.id; b.lastOpened=Date.now(); b.line=line; target.value={line,nonce:Date.now()}; panel.value=null; selection.value=null; queueSave(b); }
function goBack() { void flush(); immersive.value=false; currentId.value=null; panel.value=null; selection.value=null; window.getSelection()?.removeAllRanges(); }
function jump(line:number) { target.value={line,nonce:target.value.nonce+1}; panel.value=null; selection.value=null; }
function clearSelection() { selection.value=null; window.getSelection()?.removeAllRanges(); }
function toggleImmersive() { if (!selection.value && !modalOpen.value) immersive.value=!immersive.value; }
watch(selection, value => {
  if (!value) { showMarkOptions.value=false; draggingSelection.value=false; return; }
  const existing = book.value && lineationsForRange(book.value.annotations,value)[0]?.lineation;
  if (existing) { markType.value=existing.type; colorIndex.value=existing.colorIndex; }
});
watch(immersive, value => { void setReadingMode(value).catch(fail); });
function adjacentChapter(offset:number) { const c=chapters.value[chapterIndex.value+offset]; if(c) jump(c.line); }
async function useExcerpt(action:'copy'|'share') {
  if (!selection.value || !book.value) return;
  const title = selectedReference.value || book.value.title;
  const text = `${selection.value.text}\n——${book.value.title} · ${title}`;
  try {
    if(action==='copy') { await copyText(text); toast(isBible.value ? '已复制经文与出处' : '已复制摘录与出处'); }
    else { const result=await shareText(title,text); if(result==='copied') toast('当前浏览器不支持分享，已复制内容'); }
  } catch(e) { if(!(e instanceof Error && (e.name==='AbortError' || /cancel/i.test(e.message)))) fail(e); }
}
function openPanel(value:typeof panel.value) { selection.value=null; window.getSelection()?.removeAllRanges(); panel.value=value; if (value==='chapters') selectedVolume.value=currentChapter.value?.book ?? ''; }
async function pickFiles(event:Event) {
  const input=event.target as HTMLInputElement; const files=[...input.files??[]]; busy.value=true;
  try { for (const file of files) { const b=await importBook(file); await saveBook(b); books.value.push(b); } if (files.length) { showImport.value=false; toast(`已导入 ${files.length} 本书`); } }
  catch(e) { fail(e); } finally { input.value=''; busy.value=false; }
}
function onProgress(line:number) { if(book.value) { book.value.line=line; queueSave(); } }
function applyLineation(type: 'marker'|'wavy'|'straight', color: number, toggleSameType = false, colorOnly = false) {
  if (!book.value || !selection.value) return;
  const existing=selectedLineations.value;
  const remove=toggleSameType && existing.length>0 && existing.every(annotation => annotation.lineation?.type===type);
  book.value.annotations=updateLineation(book.value.annotations,selection.value,remove?null:{type,colorIndex:color},Date.now());
  queueSave();
  toast(remove?'已取消划线':colorOnly?'已更新划线颜色':existing.length?(existing.every(annotation => annotation.lineation?.type===type)?'已更新划线':'已更换划线样式'):'已添加划线');
}
function annotate(type: 'marker'|'wavy'|'straight') { markType.value=type; applyLineation(type,colorIndex.value,true); }
function chooseMarkColor(index: number) { colorIndex.value=index; if(selectedLineation.value) applyLineation(markType.value,index,false,true); }
function removeLineation() { if(selection.value) applyLineation(markType.value,colorIndex.value,false); }
function startNote(existing?:Annotation) {
  editingNote.value=existing ?? null; draftSelection.value=existing ?? selection.value;
  if (!draftSelection.value) return;
  draftNote.value=existing?.note?.content ?? ''; showNote.value=true; selection.value=null;
  window.getSelection()?.removeAllRanges(); void nextTick(() => noteInput.value?.focus());
}
async function submitNote() {
  if (!book.value || !draftSelection.value || !draftNote.value.trim()) return;
  const now=Date.now();
  if (editingNote.value) { const a=editingNote.value; a.note={content:draftNote.value.trim(),createdAt:a.note?.createdAt ?? now,updatedAt:now}; a.updatedAt=now; }
  else book.value.annotations.push({...draftSelection.value,id:crypto.randomUUID(),note:{content:draftNote.value.trim(),createdAt:now,updatedAt:now},createdAt:now,updatedAt:now});
  queueSave(); await flush(); showNote.value=false; toast('笔记已保存');
}
function addKeyword() {
  if(!selection.value || !book.value) return;
  const text=selection.value.text.trim();
  if(text.length>40 || text.includes('\n')) { toast('请选中 40 字以内的单行关键词'); return; }
  const existing=book.value.keywords.find(k => k.text===text); if(existing) existing.color=colorIndex.value; else book.value.keywords.push({text,color:colorIndex.value});
  queueSave(); selection.value=null; window.getSelection()?.removeAllRanges(); toast('已为全书中的这个词上色');
}
function toggleBookmark() {
  if (!book.value) return;
  const list=book.value.bookmarks, at=list.indexOf(book.value.line);
  if(at>=0) list.splice(at,1); else list.push(book.value.line);
  queueSave(); toast(at>=0?'已移除书签':'已添加书签');
}
async function exportNotes(format:'md'|'json') {
  if(!book.value) return;
  try { await exportText(`${book.value.title}.notes.${format}`,format==='md'?notesMarkdown(book.value):annotationJson(book.value),format==='md'?'text/markdown':'application/json'); } catch(e) { fail(e); }
}
async function importNotes(event:Event) {
  const input=event.target as HTMLInputElement;
  try {
    if(!input.files?.[0] || !book.value) return;
    const data=JSON.parse(await input.files[0].text());
    if(data.schemaVersion!==1 || !Array.isArray(data.annotations)) throw new Error('请选择彩读导出的笔记 JSON。');
    const valid=validAnnotations(data.annotations,book.value.content.split('\n'));
    if(!valid.length && data.annotations.length) throw new Error('笔记与当前正文不匹配，未导入。');
    const ids=new Set(book.value.annotations.map(a => a.id));
    const fresh=valid.filter(a => !ids.has(a.id)); book.value.annotations.push(...fresh); queueSave(); toast(`导入 ${fresh.length} 条笔记，跳过 ${data.annotations.length-valid.length} 条不匹配记录`);
  } catch(e) { fail(e); } finally { input.value=''; }
}
async function deleteBook() { const b=pendingDelete.value; if(!b || b.builtin) return; try { await flush(); await removeBook(b.id); books.value=books.value.filter(x=>x.id!==b.id); pendingDelete.value=null; } catch(e) { fail(e); } }
function deleteAnnotation() { if(!book.value || !pendingRemoveNote.value) return; book.value.annotations=book.value.annotations.filter(a=>a.id!==pendingRemoveNote.value!.id); queueSave(); pendingRemoveNote.value=null; }
watch(settings, s => { if(ready.value) void saveSettings(s).catch(fail); }, {deep:true});
watch(() => settings.value.theme, theme => { document.documentElement.dataset.theme=theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#1e1e1e':'#f6f7f9'); },{immediate:true});
function onKey(event:KeyboardEvent) {
  if(event.key==='Escape') dismiss();
  if(event.key==='Tab') {
    const dialogs=document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]');
    const dialog=dialogs[dialogs.length-1]; if(!dialog) return;
    const nodes=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,a[href]')].filter(el=>el.getClientRects().length);
    const first=nodes[0], last=nodes[nodes.length-1];
    if(event.shiftKey && (document.activeElement===first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if(!event.shiftKey && (document.activeElement===last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }
}
const modalOpen = computed(() => !!(panel.value || showNote.value || showImport.value || pendingDelete.value || pendingRemoveNote.value || error.value));
let returnFocus: HTMLElement | null = null;
watch(modalOpen, (open) => { if (open) returnFocus = document.activeElement as HTMLElement; });
watch([panel,showNote,showImport,pendingDelete,pendingRemoveNote,error], async () => {
  await nextTick();
  const dialogs=document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]');
  const dialog=dialogs[dialogs.length-1];
  if(dialog && !dialog.contains(document.activeElement)) dialog.focus();
  if (!dialog && returnFocus?.isConnected) { returnFocus.focus({preventScroll:true}); returnFocus=null; }
});
function dismiss() { if(error.value) error.value=''; else if(showImport.value) showImport.value=false; else if(showNote.value) showNote.value=false; else if(pendingDelete.value) pendingDelete.value=null; else if(pendingRemoveNote.value) pendingRemoveNote.value=null; else if(panel.value==='chapters' && bibleNavigator.value?.back()) return; else if(panel.value) panel.value=null; else if(showMarkOptions.value) showMarkOptions.value=false; else if(selection.value) clearSelection(); else if(immersive.value) immersive.value=false; else if(book.value) goBack(); }
function onHidden() { if(document.hidden) void flush(); }
let removeNative: (()=>void)|undefined;
onMounted(() => { void initialize(); window.addEventListener('keydown',onKey); document.addEventListener('visibilitychange',onHidden); window.addEventListener('pagehide',flush);
  if(Capacitor.isNativePlatform()) { void NativeApp.addListener('backButton',({canGoBack}) => { if(book.value || panel.value || showNote.value || showImport.value || error.value || pendingDelete.value || pendingRemoveNote.value) dismiss(); else if(canGoBack) window.history.back(); else void NativeApp.minimizeApp(); }).then(h => removeNative=()=>{void h.remove();}); }
});
onBeforeUnmount(() => { void flush(); void setReadingMode(false).catch(fail); clearTimeout(noticeTimer); window.removeEventListener('keydown',onKey); document.removeEventListener('visibilitychange',onHidden); window.removeEventListener('pagehide',flush); removeNative?.(); });
</script>

<template>
  <main class="app-shell" :class="{ 'reading': !!book, immersive, 'selecting':!!selection }">
    <div class="app-content" :inert="modalOpen">
    <input ref="fileInput" class="visually-hidden" type="file" accept=".txt,.md,.ctz" multiple @change="pickFiles" />
    <div v-if="!ready" class="startup"><BookOpen :size="40"/><h1>彩读</h1><p>{{busy?'正在准备离线书库…':'书库暂时无法打开'}}</p><button v-if="!busy" class="primary" @click="initialize">重试</button></div>
    <template v-else-if="!book">
      <header class="home-header"><div class="brand"><span class="brand-symbol"><BookOpen :size="23"/></span><span>彩读<span class="brand-en">ColorTxt</span></span></div><button class="icon-button" aria-label="导入书籍" :disabled="busy" @click="showImport=true"><Plus/></button></header>
      <section v-if="tab==='books'" class="home-content">
        <div class="page-title"><div><h1>我的书架</h1><p>{{ books.length }} 本书 · 内容与笔记保存在本机</p></div><span class="count-label">离线书库</span></div>
        <label class="search-field"><Search :size="19"/><input v-model="libraryQuery" placeholder="搜索书名" aria-label="搜索书名"/><button v-if="libraryQuery" class="small-icon" aria-label="清空搜索" @click="libraryQuery=''"><X :size="18"/></button></label>
        <div class="section-caption"><h2>全部书籍</h2><button class="text-button" :disabled="busy" @click="showImport=true"><FolderOpen :size="16"/>导入</button></div>
        <div class="book-list">
          <div v-for="(b,i) in library" :key="b.id" class="book-row">
            <button class="book-open" @click="openBook(b)">
              <div class="book-cover" :class="['cover-'+i%3, { bible:b.builtin }]" aria-hidden="true"><span class="cover-top">{{b.builtin?'旧约 · 新约':'ColorTxt'}}</span><strong>{{b.title.slice(0,12)}}</strong><span class="cover-bottom">{{b.builtin?'HOLY BIBLE':'阅读 · 记录'}}</span><span class="cover-line"></span></div>
              <div class="book-info"><span v-if="b.builtin" class="builtin-label">内置书籍</span><h3>{{b.title}}</h3><p>{{b.chapters.length}} 章 · {{b.annotations.length}} 条标注</p><div class="progress-track"><i :style="{width:Math.round(b.line/Math.max(1,b.content.split('\n').length)*100)+'%'}"></i></div><span class="book-progress">{{ b.line>1 ? '继续阅读 · '+b.chapters[chapterAt(b.chapters,b.line)]?.title : '开始阅读' }}</span></div><ChevronRight :size="19" class="muted"/>
            </button>
            <button v-if="!b.builtin" class="small-icon delete-book" :aria-label="'删除'+b.title" @click="pendingDelete=b"><Trash2 :size="17"/></button>
          </div>
        </div>
        <div v-if="!library.length" class="empty-state"><Search/><h3>没有找到这本书</h3><p>换个书名，或导入本地文件。</p></div>
        <button class="import-drop" :disabled="busy" @click="showImport=true"><FolderOpen :size="24"/><span><strong>{{busy?'正在导入…':'把喜欢的书带进来'}}</strong><small>支持 TXT、Markdown、彩读书包</small></span><Plus :size="20"/></button>
        <div class="shelf-tip"><Highlighter :size="17"/><p>读到有感触的地方，长按文字就能划线和记笔记。</p></div>
      </section>
      <section v-else-if="tab==='notes'" class="home-content"><div class="page-title"><div><h1>阅读笔记</h1><p>{{allNotes.length}} 条想法与摘录</p></div><PencilLine class="muted"/></div><div v-if="!allNotes.length" class="empty-state"><PencilLine :size="32"/><h3>留下阅读的痕迹</h3><p>在正文中长按选择文字，添加第一条笔记。</p><button class="primary" @click="tab='books'">去读一本书</button></div><button v-for="item in allNotes" :key="item.annotation.id" class="global-note" @click="openBook(item.book,item.annotation.startPhysicalLine)"><small>{{item.book.title}} · {{item.book.chapters[chapterAt(item.book.chapters,item.annotation.startPhysicalLine)]?.title}}</small><blockquote>{{item.annotation.text}}</blockquote><p v-if="item.annotation.note">{{item.annotation.note.content}}</p><span>回到原文 <ChevronRight :size="14"/></span></button></section>
      <section v-else class="home-content"><div class="page-title"><div><h1>阅读设置</h1><p>让文字以你喜欢的样子出现</p></div></div><div class="settings-group"><h2>显示</h2><div class="theme-options"><button v-for="theme in (['light','paper','dark'] as const)" :key="theme" :class="[theme,{selected:settings.theme===theme}]" @click="settings.theme=theme">{{{light:'明亮',paper:'纸色',dark:'深色'}[theme]}}<Check v-if="settings.theme===theme" :size="16"/></button></div><label class="setting-row"><span>彩色正文<small>对白、括号与关键词上色</small></span><input v-model="settings.colorize" type="checkbox" role="switch"/></label><label class="setting-row"><span>宋体阅读<small>正文采用设备自带宋体</small></span><input v-model="settings.serif" type="checkbox" role="switch"/></label><label class="range-row">字号 <span>{{settings.fontSize}}</span><input v-model.number="settings.fontSize" aria-label="字号" type="range" min="16" max="32"/></label><label class="range-row">行间距 <span>{{settings.lineHeight.toFixed(2)}}</span><input v-model.number="settings.lineHeight" aria-label="行间距" type="range" min="1.4" max="2.6" step="0.05"/></label></div><div class="settings-group"><h2>关于彩读移动版</h2><p class="about-copy">基于 ColorTxt 开源项目构建。书籍、进度和笔记保存在本机，跨设备同步尚未接入，请定期导出重要笔记。</p><a href="https://github.com/ssnangua/ColorTxt" target="_blank" rel="noopener noreferrer">查看上游项目 ↗</a><p class="version">移动版 1.0.2 · MPL-2.0</p></div></section>
      <nav class="bottom-nav" aria-label="主导航"><button :class="{active:tab==='books'}" @click="tab='books'"><BookOpen :size="23"/>书架</button><button :class="{active:tab==='notes'}" @click="tab='notes'"><PencilLine :size="23"/>笔记</button><button :class="{active:tab==='settings'}" @click="tab='settings'"><Settings2 :size="23"/>设置</button></nav>
    </template>
    <template v-else>
      <header v-show="!immersive" class="reader-header"><button class="icon-button" aria-label="返回书架" @click="goBack"><ChevronLeft/></button><button class="passage-trigger" :aria-label="isBible ? '选择书卷和章节' : '选择章节'" aria-haspopup="dialog" @click="openPanel('chapters')"><strong><span>{{isBible ? currentChapter?.book + ' ' + currentChapter?.chapter + '章' : book.title}}</span><ChevronDown :size="16"/></strong><small>{{isBible ? '圣经 · 离线阅读' : currentChapter?.title}}</small></button><button class="icon-button" aria-label="搜索正文" @click="openPanel('search')"><Search :size="21"/></button><button class="icon-button" aria-label="添加或移除当前位置书签" :class="{active:book.bookmarks.includes(book.line)}" @click="toggleBookmark"><Bookmark :size="21"/></button></header>
      <ReaderView :key="book.id" :book="book" :settings="settings" :target="target" :selection="selection" :immersive="immersive" @progress="onProgress" @select="selection=$event" @inspect="startNote" @immerse="toggleImmersive" @dragging="draggingSelection=$event"/>
      <button v-if="immersive && !selection" class="immersive-exit icon-button" aria-label="退出沉浸阅读" @click="immersive=false"><Minimize :size="18"/></button>
      <div v-if="immersive && !selection" class="immersive-status" aria-hidden="true"><span>{{currentChapter?.title}}</span><span>{{progress}}%</span></div>
      <div v-show="!immersive && !selection" class="reader-bottom">
      <div class="reading-status"><span>{{progress}}%</span><span>{{isBible ? currentChapter?.title : book.annotations.length + ' 条标注'}}</span><span>{{chapterIndex+1}} / {{chapters.length}} 章</span></div>
      <div v-if="isBible && !selection" class="chapter-switch"><button :disabled="chapterIndex===0" @click="adjacentChapter(-1)"><ChevronLeft :size="18"/>上一章</button><button @click="openPanel('chapters')">{{currentChapter?.book}} {{currentChapter?.chapter}}<ChevronDown :size="15"/></button><button :disabled="chapterIndex===chapters.length-1" @click="adjacentChapter(1)">下一章<ChevronRight :size="18"/></button></div>
      <footer class="reader-tools" aria-label="阅读工具"><button @click="openPanel('chapters')"><List/>{{isBible ? '选经' : '目录'}}</button><button @click="openPanel('notes')"><PencilLine/>笔记<span v-if="book.annotations.length" class="tool-count">{{book.annotations.length}}</span></button><button @click="openPanel('keywords')"><Highlighter/>高亮词</button><button @click="openPanel('appearance')"><Type/>排版</button><button aria-label="进入沉浸阅读" @click="toggleImmersive"><Maximize/>沉浸</button></footer>
      </div>
      <div v-if="selection" class="selection-tools" :class="{'is-dragging':draggingSelection}" role="region" aria-label="选中文字操作">
        <div class="selection-heading"><div><strong>{{selectedReference || '已选文字'}}</strong><small>{{selection.text.length}} 字 · 拖动手柄调整范围</small></div><button class="small-icon" aria-label="取消选中" @click="clearSelection"><X :size="20"/></button></div>
        <div v-if="showMarkOptions" id="mark-options" class="mark-options">
          <div class="color-options" aria-label="标注颜色"><button v-for="(color,i) in annotationColors" :key="color" :style="{'--swatch':color}" :class="{selected:colorIndex===i}" :aria-label="'标注颜色 '+(i+1)" :aria-pressed="colorIndex===i" @click="chooseMarkColor(i)"><Check v-if="colorIndex===i" :size="19"/></button></div>
          <div class="mark-types"><button v-for="item in ([{type:'marker',label:'底色',icon:Highlighter},{type:'straight',label:'直线',icon:Underline},{type:'wavy',label:'波浪线',icon:Waves}] as const)" :key="item.type" :aria-pressed="selectedLineation?.type===item.type" :class="{active:selectedLineation?.type===item.type}" @click="annotate(item.type)"><component :is="item.icon" :size="17"/>{{item.label}}</button><button v-if="selectedLineations.length" class="remove-mark" aria-label="取消划线" @click="removeLineation"><X :size="17"/>取消</button></div>
          <button class="keyword-action" @click="addKeyword"><Palette :size="16"/>设为全书高亮词<ChevronRight :size="15"/></button>
        </div>
        <div class="excerpt-actions"><button @click="useExcerpt('copy')"><Copy :size="20"/>复制</button><button @click="startNote()"><PencilLine :size="20"/>笔记</button><button :aria-expanded="showMarkOptions" aria-controls="mark-options" :class="{active:showMarkOptions}" @click="showMarkOptions=!showMarkOptions"><Highlighter :size="20"/>划线<ChevronDown :size="12"/></button><button @click="useExcerpt('share')"><Share2 :size="20"/>分享</button></div>
      </div>
    </template>

    </div>
    <div v-if="showImport" class="overlay" @click.self="showImport=false"><section class="sheet" role="dialog" aria-modal="true" aria-label="导入书籍" tabindex="-1">
      <div class="sheet-handle"></div><header class="sheet-header"><h2>导入书籍</h2><button class="icon-button" aria-label="关闭导入" @click="showImport=false"><X :size="21"/></button></header>
      <div class="sheet-content import-content"><div class="import-intro"><FolderOpen :size="32"/><h3>把喜欢的书带进来</h3><p>从手机或电脑选择文件，导入后即可离线阅读。</p></div>
        <div class="format-row"><FileText :size="21"/><div><strong>TXT 纯文本</strong><small>支持 UTF-8、UTF-16 和常见中文编码</small></div><span>.txt</span></div>
        <div class="format-row"><FileText :size="21"/><div><strong>Markdown 文档</strong><small>以纯文本阅读，保留章节和原始位置</small></div><span>.md</span></div>
        <div class="format-row"><BookOpen :size="21"/><div><strong>彩读书包</strong><small>导入未加密书包中的正文、标注与进度</small></div><span>.ctz</span></div>
        <button class="primary choose-local" :disabled="busy" @click="fileInput?.click()"><Plus :size="19"/>选择本地文件</button><p class="import-footnote">文件保存在当前设备，可一次选择多本书。</p>
      </div>
    </section></div>

    <div v-if="panel && book" class="overlay" @click.self="panel=null"><section class="sheet" :class="{'bible-sheet':panel==='chapters' && isBible}" role="dialog" aria-modal="true" :aria-label="panel==='chapters' && isBible ? '选择经文' : {chapters:'章节目录',notes:'本书笔记',appearance:'阅读排版',search:'搜索正文',keywords:'高亮词'}[panel]" tabindex="-1">
      <div class="sheet-handle"></div><header class="sheet-header"><h2>{{panel==='chapters' && isBible ? '选择经文' : {chapters:'章节目录',notes:'本书笔记',appearance:'阅读排版',search:'搜索正文',keywords:'高亮词'}[panel]}}</h2><button class="icon-button" aria-label="关闭面板" @click="panel=null"><X :size="21"/></button></header>
      <BibleNavigator v-if="panel==='chapters' && isBible" ref="bibleNavigator" :chapters="chapters" :lines="currentLines" :line="book.line" @jump="jump"/>
      <div v-else class="sheet-content">
        <template v-if="panel==='chapters'"><div v-if="volumes.length" class="volume-select"><label>卷名<select v-model="selectedVolume"><option value="">全部 {{volumes.length}} 卷</option><option v-for="v in volumes" :key="v" :value="v">{{v}}</option></select></label></div><label class="search-field"><Search :size="18"/><input v-model="chapterQuery" placeholder="搜索章节" aria-label="搜索章节"/></label><button v-for="chapter in visibleChapters" :key="chapter.line" class="chapter-row" :class="{active:currentChapter?.line===chapter.line}" @click="jump(chapter.line)"><span>{{chapter.title}}</span><Check v-if="currentChapter?.line===chapter.line" :size="18"/><ChevronRight v-else :size="17"/></button><p v-if="!visibleChapters.length" class="empty-copy">没有匹配的章节</p></template>
        <template v-else-if="panel==='notes'"><div class="export-actions"><button @click="exportNotes('md')"><Download :size="17"/>Markdown</button><button @click="exportNotes('json')"><Download :size="17"/>JSON</button><label class="import-notes">导入 JSON<input class="visually-hidden" type="file" accept=".json" @change="importNotes"/></label></div><div v-if="book.bookmarks.length" class="bookmark-list"><h3>书签</h3><button v-for="line in book.bookmarks" :key="line" class="chapter-row" @click="jump(line)"><Bookmark :size="17"/><span>{{chapters[chapterAt(chapters,line)]?.title}} · 第 {{line}} 行</span><ChevronRight :size="17"/></button></div><div v-if="!book.annotations.length" class="empty-state"><PencilLine/><p>长按正文选择文字，记下你的想法。</p></div><div v-for="a in book.annotations" :key="a.id" class="annotation-card"><small>{{chapters[chapterAt(chapters,a.startPhysicalLine)]?.title}}</small><button class="quote-button" @click="jump(a.startPhysicalLine)"><blockquote :style="{'--annotation-color':annotationColors[(a.lineation?.colorIndex??2)%annotationColors.length]}">{{a.text}}</blockquote></button><p v-if="a.note">{{a.note.content}}</p><div class="note-actions"><button class="text-button" @click="startNote(a)"><PencilLine :size="16"/>{{a.note?'编辑笔记':'添加笔记'}}</button><button class="small-icon" aria-label="删除这条标注" @click="pendingRemoveNote=a"><Trash2 :size="17"/></button></div></div></template>
        <template v-else-if="panel==='appearance'"><div class="theme-options"><button v-for="theme in (['light','paper','dark'] as const)" :key="theme" :class="[theme,{selected:settings.theme===theme}]" @click="settings.theme=theme">{{{light:'明亮',paper:'纸色',dark:'深色'}[theme]}}<Check v-if="settings.theme===theme" :size="16"/></button></div><label class="range-row">字号 <span>{{settings.fontSize}}</span><input v-model.number="settings.fontSize" aria-label="字号" type="range" min="16" max="32"/></label><label class="range-row">行间距 <span>{{settings.lineHeight.toFixed(2)}}</span><input v-model.number="settings.lineHeight" aria-label="行间距" type="range" min="1.4" max="2.6" step="0.05"/></label><label class="setting-row"><span>彩色正文</span><input v-model="settings.colorize" type="checkbox" role="switch"/></label><label class="setting-row"><span>宋体阅读</span><input v-model="settings.serif" type="checkbox" role="switch"/></label><p class="appearance-preview" :class="{serif:settings.serif}" :style="{fontSize:settings.fontSize+'px',lineHeight:settings.lineHeight}">文字有自己的颜色，阅读有自己的节奏。</p></template>
        <template v-else-if="panel==='search'"><label class="search-field"><Search :size="19"/><input v-model="query" placeholder="搜索本书内容" aria-label="搜索本书内容"/></label><p class="search-summary">{{query.trim()?`找到 ${searchResults.length}${searchResults.length===100?'＋':''} 处匹配`:'输入文字，搜索整本书'}}</p><button v-for="result in searchResults" :key="result.line" class="search-result" @click="jump(result.line)"><small>{{chapters[chapterAt(chapters,result.line)]?.title}}</small><p>{{result.text}}</p></button></template>
        <template v-else-if="panel==='keywords'"><p class="empty-copy">长按正文选中人名或关键词，点击「高亮词」，为全书中的相同词语上色。</p><div v-for="(keyword,i) in book.keywords" :key="keyword.text" class="keyword-row"><span :style="{color:wordColors[keyword.color]}">{{keyword.text}}</span><button class="small-icon" :aria-label="'移除高亮词'+keyword.text" @click="book.keywords.splice(i,1);queueSave()"><X :size="18"/></button></div></template>
      </div>
    </section></div>

    <div v-if="showNote" class="overlay foreground" @click.self="showNote=false"><form class="sheet note-editor" role="dialog" tabindex="-1" aria-modal="true" aria-label="编辑阅读笔记" @submit.prevent="submitNote"><header class="sheet-header"><button class="text-button" type="button" @click="showNote=false">取消</button><h2>{{editingNote?.note?'编辑笔记':'记下想法'}}</h2><button class="text-button" :disabled="!draftNote.trim()" type="submit">保存</button></header><blockquote>{{draftSelection?.text}}</blockquote><textarea ref="noteInput" v-model="draftNote" aria-label="笔记内容" placeholder="这一刻，你想到了什么？" rows="6" maxlength="20000"></textarea><small class="draft-count">{{draftNote.length}} / 20000</small></form></div>
    <div v-if="pendingDelete || pendingRemoveNote" class="overlay foreground" @click.self="pendingDelete=null;pendingRemoveNote=null"><section class="confirm-dialog" role="alertdialog" tabindex="-1" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">{{pendingDelete?'移除这本书？':'删除这条标注？'}}</h2><p>{{pendingDelete?'本机保存的正文和阅读笔记也会删除。':'这条划线及其笔记将一并删除。'}}</p><div><button @click="pendingDelete=null;pendingRemoveNote=null">取消</button><button class="danger" @click="pendingDelete?deleteBook():deleteAnnotation()">确认删除</button></div></section></div>
    <div v-if="error" class="overlay foreground" @click.self="error=''"><section class="confirm-dialog" role="alertdialog" tabindex="-1" aria-modal="true" aria-labelledby="error-title"><h2 id="error-title">操作未完成</h2><p>{{error}}</p><button class="primary" @click="error=''">知道了</button></section></div>
    <div v-if="busy && ready" class="busy-indicator" role="status"><LoaderCircle :size="18"/>正在处理文件…</div>
    <div v-if="notice" class="toast" role="status"><Check :size="17"/>{{notice}}</div>
  </main>
</template>
