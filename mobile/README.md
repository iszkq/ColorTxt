# 彩读移动版（v1.0.2）

基于 [ColorTxt](https://github.com/ssnangua/ColorTxt) 的 Vue + Capacitor 移动端入口。保留多色正文和工具感，以 DOM 选区替代桌面 Monaco。使用上游 MPL-2.0 许可证，原项目见仓库根目录。

## 运行

需要 Node.js 22.12+（CI 使用 Node.js 24）。

```sh
cd mobile
npm ci
npm run dev
```

浏览器访问终端显示的地址，开发端口 5174。

## 页面预览

启动后打开 [页面预览工作台](http://localhost:5174/preview.html)，从左侧目录直接查看 15 个页面与状态。工作台使用真实应用组件，支持 iOS / Android 尺寸、三种主题、页面独立链接与交互操作。

书架、阅读、全局笔记、设置、导入、目录、搜索、选区标注、本书笔记和书签、编辑笔记、高亮词、排版、空笔记、删除确认及错误提示均可直接进入。预览使用内存中的示例内容，刷新即重置，不读取或修改正式 IndexedDB 书库。原生客户端不启用预览模式。

例如：`/preview.html#note-editor` 打开笔记编辑预览；`/index.html?preview=chapters&theme=dark` 独立打开深色目录面板。浏览器顶部刷新按钮会重置当前示例。

```sh
npm test
npm run build
npm run sync
npm run android
```

`npm run android` 打开 Android Studio；需 JDK 21、Android SDK 和真机/模拟器。生成调试 APK：`cd android` 后运行 `gradlew.bat assembleDebug`（Windows），输出 `app/build/outputs/apk/debug/app-debug.apk`。

在 macOS 安装 Xcode 后，运行 `npm ci && npm run sync && npm run ios`。iOS 工程使用 Swift Package Manager；在 Xcode 选择开发团队、Bundle ID 和设备进行签名运行。Windows 无法编译 iOS 安装包。

当前 Bundle ID / applicationId 为 `io.colortxt.mobile`；Apple 描述文件必须与该标识匹配。签名及发布配置见 [移动端发布指南](../docs/MOBILE_RELEASE.md)。

## 已实现

- 书架、导入 TXT/Markdown/未加密 CTZ；UTF-8、UTF-16、GB18030 文本编码。
- 正文对白、括号、关键词上色；五色马克笔、波浪线、直线；笔记、书签、全文搜索。
- 章节导航与阅读进度；按章节/最多 120 物理行分段渲染。
- 圣经选经面板：旧约 / 新约、书卷搜索、章数网格，可开启“精确到节”；点击标题或底部“选经”进入，支持前后章切换。
- 独立节号：点击起始节，再点结束节连续选择；长按正文仍可自由选字。选区支持五色标注、笔记、附带出处的复制和系统分享，操作栏为正文保留独立滚动空间。
- 纸色、明亮、深色主题；字号、行距、宋体；iOS 安全区、Android 返回键。
- IndexedDB 离线保存正文、进度、笔记；Markdown 与桌面兼容的 JSON 笔记导出，JSON 导入时校验原文坐标。
- 原生端通过系统分享导出笔记，浏览器端下载文件。

## 默认书籍（各客户端）

用户提供的 `Bible1.csv` 已转换为共享离线资源 `resources/builtin/bible.json` 和 `圣经.md`：66 卷、1,189 章、31,102 节。来源文件的 SHA-256 与数量记录在 `provenance.json`。

iOS、Android 及移动端网页共用一份资源，首次打开时加入书架；固定书籍 ID，升级不覆盖已有正文、进度与笔记。桌面 Windows、macOS、Linux 安装包携带相同 Markdown，初始化到 `userData/BuiltinBooks/圣经.md` 并加入书籍列表，已有文件不覆盖。默认书籍可离线阅读，移动端可按书卷、章、节定位。

移动阅读交互参考微读圣经的公开网页版、官方应用介绍，以及 AndBible / Anx Reader 的开源实现。参考依据、取舍与验收范围见 [移动阅读参考记录](../docs/MOBILE_READING_REFERENCES.md)。浏览器不支持系统分享时会复制内容；原生选字手柄、键盘和分享面板仍需 iOS / Android 真机验收。

重新生成资源：在仓库根目录运行 `node scripts/build-builtin-bible.mjs /path/to/Bible1.csv`。跨设备的阅读进度和笔记仍各自保存在本机，尚未自动同步。

## 复用与兼容边界

直接复用 `src/shared/chapterMatchBuiltinPatterns.ts` 和桌面 `lineationColors.ts`、`highlightColors.ts`。移动标注使用相同的 1-based UTF-16 物理行列范围与 `schemaVersion: 1` 导出信封，原文不匹配的记录不导入。跨客户端迁移需要导入同一份正文，然后导入笔记 JSON；也可导入桌面 CTZ 的正文与标注。

首版 CTZ 仅提取正文、标注与进度；图片、角色卡、书签和高亮词的书包迁移尚未实现。Markdown 按纯文本显示，保留原始行列以兼容笔记。加密 CTZX、EPUB/PDF、书源、AI、云端语音、WebDAV、多端自动同步和接收系统“用彩读打开”尚未接入。

数据目前保存在本机，卸载或清除应用数据会删除笔记；请使用导出功能备份。v1.0.2 继续完善移动阅读交互，尚未完成 iOS 与 Android 真机验收。桌面端完整功能与移动端支持范围见上文，两个客户端不具备全部相同功能。
