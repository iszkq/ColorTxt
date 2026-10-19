<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, BatteryFull, BookOpen, Check, ChevronRight, ExternalLink, FileInput, Highlighter, LayoutGrid, List, Maximize2, Moon, Palette, PencilLine, RotateCcw, Search, Settings2, Signal, Smartphone, Sun, Trash2, TriangleAlert, Type, Wifi } from 'lucide-vue-next';
import { previewScene, previewScenes, type PreviewSceneId } from './preview-scenes';
const icons = { books: BookOpen, reader: BookOpen, notes: PencilLine, settings: Settings2, import: FileInput, chapters: List, search: Search, selection: Highlighter, edit: PencilLine, keywords: Palette, appearance: Type, delete: Trash2, error: TriangleAlert };
const selected = ref<PreviewSceneId>(previewScene(location.hash.slice(1)).id);
const active = computed(() => previewScene(selected.value));
const groups = [...new Set(previewScenes.map(scene => scene.group))];
const device = ref<'ios' | 'android'>('ios');
const theme = ref<'paper' | 'light' | 'dark'>('paper');
const reload = ref(0), compact = ref(false), copied = ref(false);
const frame = ref<HTMLIFrameElement>();
const dimensions = computed(() => device.value === 'ios' ? { width: 390, height: 844 } : { width: 412, height: 892 });
const frameUrl = computed(() => `./index.html?preview=${selected.value}&theme=${theme.value}&device=${device.value}&v=${reload.value}`);
const sceneIndex = computed(() => previewScenes.findIndex(scene => scene.id === selected.value));
function choose(id: PreviewSceneId) { selected.value = id; location.hash = id; }
function step(direction: number) { choose(previewScenes[(sceneIndex.value + direction + previewScenes.length) % previewScenes.length].id); }
function onHash() { selected.value = previewScene(location.hash.slice(1)).id; }
async function copyLink() {
  try { await navigator.clipboard.writeText(location.href); copied.value = true; }
  catch { window.prompt('复制这个页面地址', location.href); }
}
// Fit the complete device into the canvas; the iframe retains its actual CSS viewport.
const canvas = ref<HTMLElement>();
const scale = ref(1);
let observer: ResizeObserver | undefined;
function fit() {
  if (!canvas.value) return;
  scale.value = Math.min(1, (canvas.value.clientWidth - 48) / (dimensions.value.width + 16), (canvas.value.clientHeight - 56) / (dimensions.value.height + 16));
}
watch([device, compact], async () => { await nextTick(); fit(); });
watch(selected, () => copied.value = false);
onMounted(() => { window.addEventListener('hashchange', onHash); observer = new ResizeObserver(fit); if (canvas.value) observer.observe(canvas.value); fit(); });
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('hashchange', onHash); });
</script>

<template>
  <div class="workbench" :class="{ 'focus-mode': compact }">
    <aside class="page-sidebar" aria-label="页面目录">
      <a class="workbench-brand" href="./preview.html"><span class="brand-mark"><BookOpen :size="22" /></span><span>彩读 <small>ColorTxt</small></span></a>
      <div class="sidebar-heading"><span>移动端页面预览</span><span class="page-count">{{previewScenes.length}}</span></div>
      <nav class="scene-nav">
        <section v-for="group in groups" :key="group"><h2>{{group}}</h2><button v-for="scene in previewScenes.filter(item => item.group === group)" :key="scene.id" :class="{active:selected===scene.id}" :aria-current="selected===scene.id?'page':undefined" @click="choose(scene.id)"><component :is="icons[scene.icon]" :size="17"/><span>{{scene.title}}</span><ChevronRight v-if="selected===scene.id" :size="14"/></button></section>
      </nav>
      <a class="sidebar-app-link" href="./index.html" target="_blank" rel="noopener"><Smartphone :size="16"/>打开完整应用<ExternalLink :size="14"/></a>
    </aside>

    <main class="preview-main">
      <header class="workbench-toolbar">
        <div class="toolbar-title"><LayoutGrid :size="17"/><span>页面预览</span><ChevronRight :size="14"/><strong>{{active.title}}</strong></div>
        <div class="toolbar-actions"><button title="重置当前预览" aria-label="重置当前预览" @click="reload++"><RotateCcw :size="17"/></button><button :class="{selected:compact}" title="专注预览" aria-label="切换专注预览" :aria-pressed="compact" @click="compact=!compact"><Maximize2 :size="17"/></button><button class="share-link" @click="copyLink"><Check v-if="copied" :size="15"/><span>{{copied?'已复制链接':'复制页面链接'}}</span></button></div>
      </header>
      <div class="preview-content">
        <section class="device-workspace" aria-label="交互预览">
          <div class="device-toolbar">
            <div class="segmented" aria-label="设备尺寸"><button :class="{selected:device==='ios'}" :aria-pressed="device==='ios'" @click="device='ios'">iOS</button><button :class="{selected:device==='android'}" :aria-pressed="device==='android'" @click="device='android'">Android</button></div>
            <span class="viewport-label">{{dimensions.width}} × {{dimensions.height}}</span>
            <div class="theme-switch" aria-label="预览主题"><button :class="{selected:theme==='light'}" aria-label="明亮主题" :aria-pressed="theme==='light'" @click="theme='light'"><Sun :size="16"/></button><button :class="{selected:theme==='paper'}" aria-label="纸色主题" :aria-pressed="theme==='paper'" @click="theme='paper'"><BookOpen :size="16"/></button><button :class="{selected:theme==='dark'}" aria-label="深色主题" :aria-pressed="theme==='dark'" @click="theme='dark'"><Moon :size="16"/></button></div>
          </div>
          <div ref="canvas" class="device-canvas">
            <div class="scaled-device" :style="{width:(dimensions.width+16)*scale+'px',height:(dimensions.height+16)*scale+'px'}">
              <div class="device-shell" :class="[device, {dark:theme==='dark'}]" :style="{width:dimensions.width+16+'px',height:dimensions.height+16+'px',transform:`scale(${scale})`}">
                <div class="device-status"><span>9:41</span><span v-if="device==='ios'" class="device-island"></span><span class="status-icons"><Signal :size="15"/><Wifi :size="15"/><BatteryFull :size="20"/></span></div>
                <iframe ref="frame" :key="frameUrl" :src="frameUrl" :title="active.title+'交互预览'" allow="clipboard-write"/>
                <div class="device-bottom"><span></span></div>
              </div>
            </div>
          </div>
          <footer class="preview-pager"><button aria-label="上一个页面" @click="step(-1)"><ArrowLeft :size="16"/>上一页</button><span>{{String(sceneIndex+1).padStart(2,'0')}} <span class="pager-divider">/</span> {{previewScenes.length}}</span><button aria-label="下一个页面" @click="step(1)">下一页<ArrowRight :size="16"/></button></footer>
        </section>
        <aside class="scene-details" aria-label="当前页面说明">
          <div class="detail-heading"><span class="detail-icon"><component :is="icons[active.icon]" :size="22"/></span><span>{{active.group}}</span></div>
          <h1>{{active.title}}</h1><p class="scene-description">{{active.description}}</p>
          <div class="try-actions"><h2>可以试试</h2><ul><li v-for="action in active.actions" :key="action"><span></span>{{action}}</li></ul></div>
          <div class="preview-note"><span class="live-dot"></span><strong>页面可以直接操作</strong><p>使用示例笔记与书签。预览中的修改仅在当前页面有效，不会更改正式书库。</p></div>
          <a class="open-scene" :href="frameUrl" target="_blank" rel="noopener">单独打开这个页面<ExternalLink :size="15"/></a>
        </aside>
      </div>
    </main>
  </div>
</template>
