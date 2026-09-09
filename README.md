# Todo Tracker

本地优先的 Windows 桌面 Todo 管理器：全局快速捕获 → 系统自动组织 → 你只在需要时纠正。

- 无账号、无云同步、无遥测，数据 100% 存储在本地 SQLite。
- 技术栈：Electron 33 + React 18 + TypeScript + Vite (electron-vite) + better-sqlite3 + Zustand + Tailwind CSS + shadcn/ui（Radix 原语）。

## 设计原则

1. **Capture first** —— 创建任务只需要一个标题，其余全部可选。
2. **System organizes** —— 任务进入收件箱后，由象限、截止时间、置顶等信号自动推导优先级与归属。
3. **User corrects if needed** —— 你只需要纠正系统的判断（拖一下、点一下），而不是先填一堆字段。
4. **四象限（看板 Kanban）是唯一面向用户的分类** —— 重要度/紧急度由象限自动推导，界面上不暴露独立控件（仅藏在详情「更多」里）。
5. **渐进式披露** —— 常用操作一步可达，高级信息默认折叠。

## 四个视图

| 视图 | 回答的问题 | 形态 |
| --- | --- | --- |
| **收件箱 Inbox** | 还有什么没归位？ | 分诊台：卡片直接操作（点标题改名、点圆点改象限、点日期改截止、点进度展开步骤） |
| **今天 Today** | 现在该做什么？ | 分三档：现在 / 接下来 / 稍后（按优先级评分阈值 45 / 28 自动划分） |
| **看板 Kanban** | 这件事值不值得做？ | 真 2×2 看板，四象限同屏 + 未分类暂存区，拖拽跨象限改分类、象限内插入重排 |
| **全部 All** | 找某个具体任务 | 更密集的工具化列表：搜索 / 状态 / 截止 / 排序筛选 |

- 未分类任务（`classified = false`）只出现在收件箱；一旦设定象限/截止/置顶/标签，即视为已分类并移出收件箱。
- 所有拖拽与勾选即时持久化，无确认弹窗。

## 主题

Light / Dark / System 三档，默认跟随系统，本地持久化（`prefs.json`）。
全部颜色走语义 CSS 变量（`src/index.css`），组件内不硬编码颜色。
preload 阶段同步取主题快照，避免首帧闪烁。切换入口在侧边栏底部。

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
npm run test           # 单元测试 (vitest)：优先级评分 + 视图模型
npm run build          # 构建到 out/
npm run smoke          # 构建 + 自动化冒烟测试（截图输出到 .smoke/）
npm run pack           # 打包免安装版 (release/win-unpacked/TodoTracker.exe)
npm run dist           # 打包 Windows 安装包 (release/TodoTracker-x.y.z-setup.exe)
```

冒烟测试可选参数：

| 参数 | 作用 |
| --- | --- |
| `--smoke-reset` | 清空冒烟用数据与偏好后重新播种示例数据 |
| `--smoke-light` / `--smoke-dark` | 强制浅色 / 深色主题截图 |
| `--skip-capture` | 跳过快速捕获窗口阶段（部分自动化桌面不允许同进程开第二个窗口） |

`node scripts/png-brightness.mjs .smoke/*.png` 可读取截图的平均亮度，用于快速判断当前是浅色还是深色渲染。

## 数据库位置

SQLite 数据库：`%APPDATA%/todo-tracker/todo.db`
（ Electron `app.getPath('userData')`，包含 WAL 日志文件）。
偏好（主题）：`%APPDATA%/todo-tracker/prefs.json`。
窗口位置状态：`%APPDATA%/todo-tracker/window-state.json`。
界面内可通过侧边栏「数据库位置」按钮直接打开所在目录。

Schema 版本由 `user_version` 管理，启动时增量迁移（v2 新增 `classified` / `sort_order`），既有数据不丢失。

## 键盘快捷键

| 快捷键 | 作用 |
| --- | --- |
| `Ctrl + Shift + Space` | 全局快速捕获（任何应用下可用），Enter 保存 / Esc 取消 |
| `N` | 聚焦主窗口快速新增输入框 |
| `↑` / `↓` | 在任务列表中移动选择 |
| `Space` | 完成 / 取消完成选中任务 |
| `Enter` / `E` | 打开选中任务详情 |
| `1` – `4` | 将选中任务移到对应象限（看板） |
| `Delete` | 归档选中任务（可撤销） |
| `Shift + Delete` | 彻底删除选中任务（可撤销） |
| `Esc` | 关闭详情 / 清除选择 |

## 优先级算法

实现在 `shared/priority.ts`（独立模块，可单独调参与测试），全部权重显式声明：

```
总分 = 重要度(0/12/28) + 紧急度(0/10/22)
     + 截止分(逾期 30+2/天[封顶12]，24h内 26，3天内 18，7天内 12，14天内 6，更远 2，无 0)
     + 陈旧分(min(10, 0.6/天)) + 置顶(+1000)
```

分数只用于排序与 Today 分档，不主导界面呈现。已完成/已归档任务统一沉底。
单元测试见 `tests/priority.test.ts`（评分与权重）与 `tests/model.test.ts`（象限映射、收件箱归属、Today 分档）。

## 基本架构

```
shared/               类型与纯逻辑（渲染/主进程共用，不依赖 Electron）
  types.ts            任务/步骤/筛选等数据模型
  ipc.ts              IPC 通道名与 API 签名（preload 桥接的契约）
  priority.ts         优先级评分（含单元测试）
  quadrant.ts         四象限 <-> 重要/紧急 映射 + 象限文案/配色元数据
electron/main/        主进程
  index.ts            应用生命周期、全局快捷键、单实例、冒烟测试
  windows.ts          主窗口（无边框）与快速捕获小窗、窗口状态持久化
  tray.ts             系统托盘
  db.ts               SQLite 建表/迁移 + 全部 CRUD
  prefs.ts            本地偏好（主题）读写与原生主题同步
  ipc.ts              ipcMain.handle 注册（类型化小接口）
electron/preload/     contextBridge 暴露 window.api / window.capture
  theme.ts            首帧主题快照（避免闪烁）+ 主题变更广播
src/                  渲染进程 (React)
  store/todos.ts      Zustand 全局状态（列表、选中、筛选、撤销）
  lib/visible.ts      各视图列表计算（收件箱/今天/看板/全部）
  components/
    task/             TaskCard（统一卡片语言）、QuadrantPicker、DuePicker、InlineSteps
    views/            InboxView / TodayView / KanbanBoard / AllView
    detail/           DetailPanel（渐进披露属性行 + 步骤 + 备注 + 更多）
    layout/           Sidebar / TitleBar
    theme/            ThemeProvider / ThemeToggle
    ui/               shadcn/ui 组件（Radix 原语）
```

- 关闭主窗口 = 最小化到托盘；托盘菜单可打开主窗口、快速捕获或退出。
- 主窗口与捕获窗口职责分离：捕获窗口只做一件事——保存标题到收件箱（命令面板风格）。

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
- 多显示器捕获窗记忆
