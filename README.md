# Todo Tracker

本地优先的 Windows 桌面 Todo 管理器：全局快速捕获 + 艾森豪威尔四象限 + 自动优先级排序。

- 无账号、无云同步、无遥测，数据 100% 存储在本地 SQLite。
- 技术栈：Electron 33 + React 18 + TypeScript + Vite (electron-vite) + better-sqlite3 + Zustand + Tailwind CSS + shadcn/ui 风格组件。

## 开发模式

```bash
npm install            # 安装依赖（自动跳过脚本）
node node_modules/electron/install.js   # 下载 Electron 二进制（如未下载）
node scripts/fetch-native.mjs           # 下载 better-sqlite3 预编译二进制（Electron ABI）
npm run dev            # 启动开发模式（主进程 + 渲染进程热更新）
```

> 提示：
> - 本机若没有 Visual Studio C++ 构建工具，不要执行 `electron-builder install-app-deps`
>   或 `npm rebuild`；better-sqlite3 直接使用官方预编译产物，由 `scripts/fetch-native.mjs`
>   按 Electron 的 ABI（当前 electron-v130）自动下载匹配版本。
> - 在受限/自动化终端中若启动 Electron 报 `electron.app undefined`，请清除
>   `ELECTRON_RUN_AS_NODE` 环境变量后再运行。
> - 打包下载缓慢或失败时使用镜像：
>   `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
>   `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`

```bash
npm run typecheck      # TypeScript 类型检查
npm run test           # 优先级评分单元测试 (vitest)
npm run build          # 构建到 out/
npm run smoke          # 构建 + 自动化冒烟测试（截图输出到 .smoke/）
npm run pack           # 打包免安装版 (release/win-unpacked/TodoTracker.exe)
npm run dist           # 打包 Windows 安装包 (release/TodoTracker-x.y.z-setup.exe)
```

## 数据库位置

SQLite 数据库：`%APPDATA%/todo-tracker/todo.db`
（ Electron `app.getPath('userData')`，包含 WAL 日志文件）。
窗口位置状态：`%APPDATA%/todo-tracker/window-state.json`。
界面内可通过侧边栏「数据库位置」按钮直接打开所在目录。

## 键盘快捷键

| 快捷键 | 作用 |
| --- | --- |
| `Ctrl + Shift + Space` | 全局快速捕获（任何应用下可用），Enter 保存 / Esc 取消 |
| `N` | 聚焦主窗口快速新增输入框 |
| `↑` / `↓` | 在任务列表中移动选择 |
| `Space` | 完成 / 取消完成选中任务 |
| `Enter` / `E` | 打开选中任务详情 |
| `1` – `4` | 将选中任务移到对应四象限 |
| `Delete` | 归档选中任务（可撤销） |
| `Shift + Delete` | 彻底删除选中任务（可撤销） |
| `Esc` | 关闭详情 / 清除选择 |

鼠标：四象限视图中可直接拖拽任务到目标象限（自动更新重要/紧急程度）。

## 优先级算法

实现在 `shared/priority.ts`（独立模块，可单独调参与测试），全部权重显式声明：

```
总分 = 重要度(0/12/28) + 紧急度(0/10/22)
     + 截止分(逾期 30+2/天[封顶12]，24h内 26，3天内 18，7天内 12，14天内 6，更远 2，无 0)
     + 陈旧分(min(10, 0.6/天)) + 置顶(+1000)
```

已完成/已归档任务统一沉底。单元测试见 `tests/priority.test.ts`。

## 基本架构

```
shared/               类型与纯逻辑（渲染/主进程共用，不依赖 Electron）
  types.ts            任务/步骤/筛选等数据模型
  ipc.ts              IPC 通道名与 API 签名（preload 桥接的契约）
  priority.ts         优先级评分（含单元测试）
  quadrant.ts         四象限 <-> 重要/紧急 映射
electron/main/        主进程
  index.ts            应用生命周期、全局快捷键、单实例
  windows.ts          主窗口（无边框）与快速捕获小窗、窗口状态持久化
  tray.ts             系统托盘
  db.ts               SQLite 建表/迁移 + 全部 CRUD
  ipc.ts              ipcMain.handle 注册（类型化小接口）
electron/preload/     contextBridge 暴露 window.api / window.capture
src/                  渲染进程 (React)
  store/todos.ts      Zustand 全局状态（列表、选中、筛选、撤销）
  lib/visible.ts      各视图列表计算（收件箱/今天/四象限/全部）
  components/         UI 组件（shadcn/ui 风格 + Tailwind）
```

- 关闭主窗口 = 最小化到托盘；托盘菜单可打开主窗口、快速捕获或退出。
- 主窗口与捕获窗口职责分离：捕获窗口只做一件事——保存标题到收件箱。

## 构建 Windows 可执行文件

```bash
npm run dist     # NSIS 安装包
npm run pack     # 免安装版（release/win-unpacked/TodoTracker.exe，可直接运行）
```

产物输出在 `release/`。
构建前请确保 `node scripts/fetch-native.mjs` 已成功（better-sqlite3 使用
`electron-v130` 预编译版本，与 Electron 33 匹配）。

配置说明（electron-builder.yml）：
- `npmRebuild: false` —— 不做原生模块源码重建，直接打包预编译的 better_sqlite3.node（经 asarUnpack 解包）。
- `win.signAndEditExecutable: false` —— 个人本地应用不做代码签名，可避免打包时下载
  winCodeSign（在无管理员特权的账户下解压其符号链接会失败）。如需签名可改回 `true`。

## 路线图（MVP 之后）

- 快速捕获语法解析（`明天`, `!高`, `#标签`）
- 任务回收站、循环任务、通知提醒
- 主题切换与多显示器捕获窗记忆
