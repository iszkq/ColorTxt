# 移动端构建与发布

版本：v1.0.1。应用标识：`io.colortxt.mobile`。Android versionCode 与 iOS build number：`10001`。

## 自动构建

推送 `v*` 标签会执行 [Release 工作流](../.github/workflows/release.yml)，同时构建 Windows x64、macOS arm64/x64、Linux arm64/x64、Android release APK 和 iOS 真机未签名 IPA。全部构建成功后发布对应版本，并附带中文更新说明和 SHA-256 校验值。

手动重建：在仓库 Actions → Release → Run workflow 中填写已有标签（例如 `v1.0.1`）。工作流按该标签检出源码，产物上传到对应 Release。部分任务失败可使用 Re-run failed jobs；修复源码时使用新的提交与版本标签，避免静默替换已发布的源码标签。

## Android 签名

仓库 Actions Secrets 使用以下四项：

| Secret | 内容 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | PKCS#12 发布密钥库的 Base64 |
| `ANDROID_KEYSTORE_PASSWORD` | 密钥库密码 |
| `ANDROID_KEY_ALIAS` | 密钥别名 |
| `ANDROID_KEY_PASSWORD` | 私钥密码 |

发布 APK 使用 `assembleRelease` 构建并由 `apksigner verify` 校验。持续更新必须使用同一密钥；妥善保留备份。密钥、密码、`.p12` 文件不提交到 Git，也不放进 Release 附件。本地首次配置的备份保存在仓库下被忽略的 `.release-private/` 目录。

本地签名构建时，设置 `ANDROID_KEYSTORE_PATH`（绝对路径）、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`，在 `mobile` 运行 `npm ci`、`npm run sync`，再进入 `android` 执行 `gradlew.bat assembleRelease`（macOS/Linux 为 `./gradlew assembleRelease`）。需要 Node.js 22.12+、JDK 21、Android SDK 36。

## iOS 未签名 IPA

按本分支发布方式，GitHub macOS runner 使用 `iphoneos` SDK、`Release` 配置与 `generic/platform=iOS` 目标创建关闭代码签名的 archive，然后将 `App.app` 放入 `Payload/` 压缩为 `colortxt-1.0.1-ios-unsigned.ipa`。构建会校验版本与 arm64 架构，不需要配置 Apple Secrets。

这个 IPA 需要你使用自己的工具和 Apple 证书重新签名，再通过所选签名方式安装。若使用 Ad Hoc 描述文件，必须包含目标设备的 UDID；企业分发须符合证书适用范围。App Store 描述文件对应 TestFlight/App Store 分发，不能当作普通 IPA 直接安装。重新签名时如修改 Bundle ID，应同步处理签名权限与描述文件。

Windows 无法运行 Xcode；本地构建需在安装 Xcode 的 macOS 上，在 `mobile` 中执行：

```sh
npm ci
npm run sync
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath "$PWD/ios/build/ColorTxt.xcarchive" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' archive
mkdir -p output/ios/Payload
cp -R ios/build/ColorTxt.xcarchive/Products/Applications/App.app output/ios/Payload/
(cd output/ios && zip -qry ../colortxt-1.0.1-ios-unsigned.ipa Payload)
```

## 页面预览与功能范围

参见 [移动端 README](../mobile/README.md)。`npm run dev` 后打开 `http://localhost:5174/preview.html`，即可查看全部页面与状态。预览不修改正式书库；安装包内也不会启用预览数据。

移动端尚未完成真机验收，桌面端与移动端功能存在差异。默认书籍、导入、章节、笔记导出与本机存储可用于进一步验证；跨设备自动同步、AI、书源、语音等功能尚未移植。
