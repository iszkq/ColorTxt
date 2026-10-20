# 阅读触摸验收

从仓库根目录执行。先在独立终端启动移动端开发服务器：

```powershell
npm --prefix mobile run dev -- --port 5174
```

浏览器脚本使用 Playwright CLI 的 `run-code` 格式，不依赖应用的生产代码。脚本创建自己的 Chromium 移动上下文，使用 CDP 触摸事件执行长按、拖动和滑动，预览数据不会修改真实书架。

```powershell
npx --yes --package @playwright/cli playwright-cli -s=reader open http://localhost:5174
npx --yes --package @playwright/cli playwright-cli -s=reader run-code --filename=mobile/e2e/reader-touch.js
npx --yes --package @playwright/cli playwright-cli -s=reader run-code --filename=mobile/e2e/reader-boundaries.js
npx --yes --package @playwright/cli playwright-cli -s=reader close
```

`reader-touch.js` 检查长按、首柄细选、笔记、跨节划线、滑动防误触、沉浸位置、卷章节定位和 320 / 390 / 768px 选经面板。`reader-boundaries.js` 检查跨节尾柄、首尾交叉、边缘自动滚动、普通文本、键盘及鼠标拖选，并检查 320 / 768px 展开操作栏的触摸尺寸。

截图输出到忽略的 `output/playwright/`。这些检查不能替代 Android / iOS 编译与真机手势、安全区、系统栏、软键盘和分享验收。
