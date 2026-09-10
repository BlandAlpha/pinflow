# TODO Tracker 项目约定

- 本项目是"本地优先 Windows Todo 管理器"：Electron 33 + React 18 + TS + electron-vite + better-sqlite3 + Zustand + Tailwind/shadcn 风格组件。
- 用户要求：git 管理版本、commit message 用中文、按 milestone 验收；UI 用 shadcn UI 保持一致美观；优先可运行 MVP，不过度设计。
- SQLite 二进制不能本地编译（无 MSVC）：始终用 `node scripts/fetch-native.mjs` 下载预编译版；打包不做原生重建。
- 打包唯一路径是 Electron Forge（`forge.config.js`）：`npm run package`（免安装版 `forge-dist/todo-tracker-win32-x64/todo-tracker.exe`）/ `npm run make`（Squirrel 安装包 `forge-dist/make/squirrel.windows/x64/`）。electron-builder 已彻底移除（配置、脚本、依赖）。
- 构建产物目录是 `app-build/`（不是 `out/`，Forge 硬编码忽略根目录 out/）；`forge-dist/` 是用户已编译好的可分发产物，**不要删除**。
- 下载 Electron 用 npmmirror 镜像（写在 `.npmrc`）。
- 数据库：`%APPDATA%/todo-tracker/todo.db`；冒烟测试数据在 `.../smoke` 子目录（`npm run smoke`，`--skip-capture` 可跳过捕获窗阶段）。
- 本沙箱限制：GUI 程序须后台启动；需 `env -u ELECTRON_RUN_AS_NODE`；同一进程第二个 BrowserWindow 创建会被环境阻塞（真实桌面无此问题）；冒烟跑完进程不会自退，循环跑多轮时要加 `timeout` 并在轮次间结束 electron 进程。
- 设计约定（第三轮重构后）：白板二维坐标（`board_x/board_y`，上=重要/左=紧急）是唯一用户可见分类；未落点=收件箱；象限只作命名/兼容；优先级选择器统一为 2D 方型 picker（详情内联、卡片徽标弹窗），不再暴露独立的象限/重要度/紧急度控件。
- 设计约定：所有颜色走语义 CSS 变量，禁止在组件里硬编码颜色；默认 System 主题并持久化；主题切换只用图标（跟随系统=日月组合图标），标签仅 浅色/深色/跟随系统。
- 侧栏三档响应式：>=1240 完整 / >=1040 紧凑(图标+计数) / <1040 仅图标(悬停浮层展开)；底部只放主题切换+设置，开机启动/数据库位置/快捷键收进设置弹窗。
- 验证手段：`node scripts/png-brightness.mjs .smoke/*.png` 判断截图明暗与是否空白（模型无法直接看图时用它替代）。
- 冒烟交互校验：`--smoke-interact`（合成指针/滚轮事件验证白板拖拽/缩放/平移/空间切换），结果在 `.smoke/interact.json`。
- 沙箱构建坑：electron / electron-vite build 必须后台运行，前台会静默无输出；build 前先 `rm -rf app-build`（否则 safe-delete 阈值拦截 emptyDir）；杀 electron 用 PowerShell Stop-Process（Git Bash taskkill 无效）。
- 仓库只跟踪源码/配置/资源：构建输出（`app-build`、`forge-dist`、`.smoke`）、本地配置（`.npmrc`）、日志、`.native-cache` 均 ignore；历史误入库的 `release-v5`/`release2` 已移出版本控制并清理。
- 注意：`.workbuddy` 被 ignore 规则覆盖，提交记忆文件需 `git add -f .workbuddy/memory`。
