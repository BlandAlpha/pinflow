# TODO Tracker 项目约定

- 本项目是"本地优先 Windows Todo 管理器"：Electron 33 + React 18 + TS + electron-vite + better-sqlite3 + Zustand + Tailwind/shadcn 风格组件。
- 用户要求：git 管理版本、commit message 用中文、按 milestone 验收；UI 用 shadcn UI 保持一致美观；优先可运行 MVP，不过度设计。
- SQLite 二进制不能本地编译（无 MSVC）：始终用 `node scripts/fetch-native.mjs` 下载预编译版；打包配置 `npmRebuild: false`、`win.signAndEditExecutable: false`。
- 打包用镜像：ELECTRON_MIRROR / ELECTRON_BUILDER_BINARIES_MIRROR（npmmirror）。
- 数据库：`%APPDATA%/todo-tracker/todo.db`；冒烟测试数据在 `.../smoke` 子目录（`npm run smoke`，`--skip-capture` 可跳过捕获窗阶段）。
- 本沙箱限制：GUI 程序须后台启动；需 `env -u ELECTRON_RUN_AS_NODE`；同一进程第二个 BrowserWindow 创建会被环境阻塞（真实桌面无此问题）。
- 遗留清理项：旧 `release/` 目录 223MB（文件被锁无法删除），可手动删除；`release2/` 仅剩空壳。
