# JO videos

Windows 桌面录屏工具，基于 Electron 构建。

## 功能

- 🖥️ 全屏 / 窗口录制
- 🎤 麦克风开关
- 🎬 可配置帧率（15/24/30/60 FPS）和分辨率（720p/1080p/2K/4K/自定义）
- 👁️ 录屏时隐藏窗口（UI 可见可操作，但不出现在录制画面中）
- 📁 自定义保存目录
- 🔄 自动转码为 MP4
- ☁️ GitHub 云端更新检测

## 安装

从 [Releases](https://github.com/3679973612/JO-videos/releases) 下载 `JO-videos-Setup-x.x.x.exe`，双击运行安装向导。

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式
npm start

# 打包安装向导
npm run dist
```

## 技术栈

- Electron 33
- ffmpeg-static（视频转码）
- GitHub Releases API（云端更新）
- NSIS（Windows 安装向导）

## 许可证

MIT License
