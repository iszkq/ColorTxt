export const previewScenes = [
  { id: 'books', group: '主要页面', title: '我的书架', icon: 'books', description: '默认书籍与本地导入的书，一眼查看阅读进度。', actions: ['打开一本书开始阅读', '搜索书名', '导入本地文件'] },
  { id: 'reader', group: '主要页面', title: '阅读正文', icon: 'reader', description: '保留彩读的多色正文，搭配纸色背景与常用阅读工具。', actions: ['滚动阅读，自动记录位置', '长按选中文字进行标注', '点击底部工具打开面板'] },
  { id: 'notes', group: '主要页面', title: '阅读笔记', icon: 'notes', description: '把不同书里的想法和摘录放在一起，随时回到原文。', actions: ['查看示例笔记与摘录', '点击笔记跳回对应段落'] },
  { id: 'settings', group: '主要页面', title: '阅读设置', icon: 'settings', description: '切换主题、字体与字号，找到适合自己的阅读方式。', actions: ['切换明亮、纸色与深色', '调整字号和行间距', '开关彩色正文与宋体'] },
  { id: 'import', group: '阅读工具', title: '导入书籍', icon: 'import', description: '从设备中选择书籍，支持 TXT、Markdown 和未加密彩读书包。', actions: ['查看支持的文件类型', '选择文件体验导入'] },
  { id: 'chapters', group: '阅读工具', title: '章节目录', icon: 'chapters', description: '按卷选择、搜索章节，快速跳转到想读的位置。', actions: ['切换圣经卷名', '输入章节名搜索', '点击章节跳转正文'] },
  { id: 'search', group: '阅读工具', title: '全文搜索', icon: 'search', description: '示例已输入“光”，展示全文匹配与段落上下文。', actions: ['修改搜索关键词', '点击结果回到原文'] },
  { id: 'selection', group: '阅读工具', title: '划线与选区', icon: 'selection', description: '预选一段文字，直接体验五色标注和笔记入口。', actions: ['切换标注颜色', '添加马克笔、直线或波浪线', '点击笔记写下想法'] },
  { id: 'book-notes', group: '阅读工具', title: '本书笔记与书签', icon: 'notes', description: '在阅读中查看本书标注、编辑想法和管理书签。', actions: ['点击书签跳转', '编辑或删除标注', '导出 Markdown 或 JSON'] },
  { id: 'note-editor', group: '阅读工具', title: '编辑笔记', icon: 'edit', description: '保留原文摘录，用一个专注的编辑面板记录思考。', actions: ['编辑示例笔记', '保存后在本书笔记中查看'] },
  { id: 'keywords', group: '阅读工具', title: '全书高亮词', icon: 'keywords', description: '让全书中的同一词语保持相同颜色，帮助追踪与查找。', actions: ['查看已配置的关键词', '移除关键词上色'] },
  { id: 'appearance', group: '阅读工具', title: '阅读排版', icon: 'appearance', description: '阅读时直接调整字号、行距、字体与主题。', actions: ['拖动滑块查看变化', '切换阅读主题'] },
  { id: 'empty-notes', group: '其他状态', title: '还没有笔记', icon: 'notes', description: '第一次打开笔记页时，引导用户从阅读开始。', actions: ['点击“去读一本书”回到书架'] },
  { id: 'delete', group: '其他状态', title: '删除确认', icon: 'delete', description: '删除书籍前明确说明正文与笔记的影响。', actions: ['取消并保留书籍', '确认移除预览中的示例书籍'] },
  { id: 'error', group: '其他状态', title: '操作失败提示', icon: 'error', description: '展示可读的错误原因，让用户知道接下来该怎么做。', actions: ['关闭提示继续操作'] },
] as const;
export type PreviewSceneId = typeof previewScenes[number]['id'];
export function previewScene(id: string | null) { return previewScenes.find(scene => scene.id === id) ?? previewScenes[0]; }
