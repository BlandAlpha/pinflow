# PinFlow

本地优先的桌面 Todo 管理器（Windows / macOS）：全局快速捕获 → 系统自动组织 → 你只在需要时纠正。

- 无账号、无云同步、无遥测，数据 100% 存储在本地 SQLite。
- 技术栈：Electron 33 + React 18 + TypeScript + Vite (electron-vite) + better-sqlite3 + Zustand + Tailwind CSS + shadcn/ui（Radix 原语），打包用 Electron Forge。

## 设计原则

1. **Capture first** —— 创建任务只需要一个标题，其余全部可选。
2. **System organizes** —— 任务进入收件箱后，由白板位置、截止时间、置顶等信号自动推导优先级与归属。
3. **User corrects if needed** —— 你只需要纠正系统的判断（拖一下、点一下），而不是先填一堆字段。
4. **白板坐标是唯一面向用户的分类** —— 一块连续的「重要性 × 紧急性」二维空间（数学坐标）：上=重要、下=不重要、右=紧急、左=不紧急。重要度/紧急度由坐标自动推导，界面上不暴露重复的独立控件。
5. **渐进式披露** —— 常用操作一步可达，高级信息默认折叠。

## 四个视图

| 视图 | 回答的问题 | 形态 |
| --- | --- | --- |
| **收件箱 Inbox** | 还有什么没归位？ | 分诊台：卡片直接操作（点标题改名、点优先级徽标调 2D 选择器、点日期改截止、点进度展开步骤） |
| **今天 Today** | 现在该做什么？ | 卡片分区：现在做 / 接下来 / 稍后（按优先级评分阈值 45 / 28 自动划分），大字号标题 + 安静元信息 |
| **白板 Board** | 这件事值不值得做？ | 连续二维画布：任务是便签，按住即可拖动，松手即写库；滚轮以光标为锚点缩放（100%–300%，带补间）、左键拖空白处平移 |
| **全部 All** | 找某个具体任务 | 更密集的工具化列表：搜索 / 状态 / 截止 / 排序筛选 |

- 未落点任务（`board_x / board_y` 为空）在收件箱之外也会出现；一旦拖动到白板或设定截止/置顶/标签，即视为已归类、从收件箱移出。
- 白板坐标即 groundtruth：落点写库，所有视图双向同步，不做展示层避让。
- 所有拖拽与勾选即时持久化，无确认弹窗。

## 空间（工作 / 生活分离）

- `spaces` 表存所有空间（默认「工作 / 生活」），任务通过 `space_id` 归属；所有视图、标签、计数都按当前空间硬过滤。
- 侧边栏底栏的空间切换器一键切换；设置弹窗里可新建 / 改名 / 换图标与颜色 / 删除（删除时任务迁入其它空间，最后一个空间不可删）。
- 当前空间记在 `prefs.json`，重启后保持；任务详情面板可把单条任务移动到别的空间。

## 主题

Light / Dark / System 三档，默认跟随系统，本地持久化（`prefs.json`）。
全部颜色走语义 CSS 变量（`src/index.css`），组件内不硬编码颜色。
preload 阶段同步取主题快照，避免首帧闪烁。切换入口在侧边栏底部。

## 开发模式

```bash
npm install            # 安装依赖（自动跳过脚本）
node node_modules/electron/install.js   # 下载 Electron 二进制（如未下载）
node scripts/fetch-native.mjs           # 换成 Electron ABI 的 better-sqlite3（每次 npm install 之后都要跑，
                                        # 否则 npm 装的是 Node ABI 版本，dev 会因为 ABI 不匹配连窗口都起不来）
npm run dev            # 启动开发模式（主进程 + 渲染进程热更新）
```

> 提示：
> - 本机若没有 Visual Studio C++ 构建工具，不要执行 `npm rebuild`；better-sqlite3 直接使用官方
>   预编译产物，由 `scripts/fetch-native.mjs` 按 Electron 的 ABI（当前 electron-v130）自动下载匹配版本。
> - 在受限/自动化终端中若启动 Electron 报 `electron.app undefined`，请清除
>   `ELECTRON_RUN_AS_NODE` 环境变量后再运行。
> - 下载 Electron 二进制缓慢时使用镜像（已写入 `.npmrc`）：
>   `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
> - macOS 无需额外步骤：脚本会自动取 `Electron.app/Contents/MacOS/Electron` 的 ABI，
>   并从官方 release 下载 `better-sqlite3-…-darwin-arm64.tar.gz`（Intel 机器则是 `darwin-x64`）。

```bash
npm run typecheck      # TypeScript 类型检查（src + shared + electron + tests）
npm run test           # 单元测试 (vitest)：优先级评分 + 视图模型 + 白板坐标 + db
npm run build          # 构建到 app-build/
npm run smoke          # 构建 + 自动化冒烟测试（截图输出到 .smoke/）
npm run package        # 打包免安装版 (forge-dist/pinflow-win32-x64/pinflow.exe)
npm run make           # 构建并打包 NSIS 安装向导 (forge-dist/make/nsis/make/)
```

冒烟测试可选参数：

| 参数 | 作用 |
| --- | --- |
| `--smoke-reset` | 清空冒烟用数据与偏好后重新播种示例数据 |
| `--smoke-light` / `--smoke-dark` | 强制浅色 / 深色主题截图 |
| `--skip-capture` | 跳过快速捕获窗口阶段（部分自动化桌面不允许同进程开第二个窗口） |
| `--smoke-interact` | 合成指针/滚轮事件校验白板拖拽、缩放、平移与空间切换（结果写 `.smoke/interact.json`） |
| `--smoke-views=board` | 只跑指定视图阶段 |

`node scripts/png-brightness.mjs .smoke/*.png` 可读取截图的平均亮度，用于快速判断当前是浅色还是深色渲染。

> 冒烟测试代码在 `electron/main/smoke.ts`，由入口动态 import 且**只在未打包时加载**：
> 它把截图写进 `app.getAppPath()/.smoke`，而打包后该路径位于 asar 内（只读）。

### db 层测试默认跳过

`tests/db.test.ts` 直接跑真实 SQLite，需要 **Node ABI** 的 `better-sqlite3` 原生二进制；
而开发用的是 Electron ABI（`scripts/fetch-native.mjs` 下载的 electron-v130 版本），
两者不通用。缺少可用二进制时该组测试自动跳过，`npm test` 不会失败。

需要真正跑起来时，装一个 Node ABI 的预编译产物即可（不要覆盖 `build/Release/better_sqlite3.node`，
那是 Electron 运行时的依赖）：

```bash
# --platform / --arch 按当前机器填：Windows 是 win32-x64，macOS 是 darwin-arm64（Apple Silicon）
npx prebuild-install -r node --arch x64 --platform win32 --dir node_modules/better-sqlite3 --target_path /tmp/bs3-node
```
然后把产物放到 `node_modules/better-sqlite3/build/Release/` 下运行 `npm test`，跑完还原。

## 数据库位置

SQLite 数据库：`todo.db`（含 WAL 日志文件）；偏好（主题、当前空间）：`prefs.json`；
窗口位置状态：`window-state.json`。三者都在 Electron 的 `app.getPath('userData')` 目录下：

| 平台 | 目录 | 说明 |
| --- | --- | --- |
| Windows | `%APPDATA%/pinflow/` | 产品名 `pinflow` |
| macOS | `~/Library/Application Support/PinFlow/` | 产品名 `PinFlow`（mac 惯例带空格） |

界面内可通过设置里的「数据库位置」按钮直接打开所在目录。

Schema 版本由 `user_version` 管理，启动时增量迁移（当前 v5），既有数据不丢失：
v2 新增 `classified` / `sort_order`，v3–v4 调整白板坐标系，v5 新增 `spaces` 表与 `todos.space_id`（旧任务自动归入「工作」）。

## 键盘快捷键

| 快捷键 | 作用 |
| --- | --- |
| `Ctrl + Shift + Space` / macOS `⌘ + Shift + Space` | 全局快速捕获（任何应用下可用），Enter 保存 / Esc 取消 |
| `N` | 聚焦主窗口快速新增输入框 |
| `↑` / `↓` | 在任务列表中移动选择 |
| `Space` | 完成 / 取消完成选中任务 |
| `Enter` / `E` | 打开选中任务详情 |
| `1` – `4` | 将选中任务移到对应象限的中心（白板） |
| `Alt + 1` – `Alt + 9` / macOS `Option + 1` – `Option + 9` | 切换到第 N 个空间 |
| `Delete` / macOS `Backspace` | 归档选中任务（可撤销） |
| `Shift + Delete` / macOS `Shift + Backspace` | 彻底删除选中任务（可撤销） |
| `Esc` | 关闭详情 / 清除选择 |

> macOS 上带 Option 的组合由 `event.code` 判定 —— Option+数字会产出特殊字符（Option+1 = `¡`），
> 拿 `event.key` 是匹配不到数字的。

## 平台差异（Windows / macOS）

| 方面 | Windows | macOS |
| --- | --- | --- |
| 主窗口 | 完全无边框，标题栏与最小化 / 最大化 / 关闭按钮全部自绘 | `titleBarStyle: hiddenInset`：保留系统交通灯与原生圆角阴影，标题栏只做拖动区 |
| 应用菜单 | 无（`autoHideMenuBar`，不用菜单栏） | 屏幕顶部 App / Edit / Window 三组菜单（⌘C / ⌘V / ⌘Q / ⌘W 依赖 Edit role） |
| 系统托盘 | 彩色 16px 图标，左键唤起主窗口 | 菜单栏模板图（自动跟随深浅色），左键即弹菜单 |
| 快速捕获快捷键 | `Ctrl+Shift+Space` | `⌘+Shift+Space`（accelerator 用 `CommandOrControl`） |
| 捕获窗口 | 普通置顶窗 | 额外 `visibleOnAllWorkspaces` + `floating` 层级，切桌面 / 全屏应用下也能浮出 |
| 全屏屏蔽快捷键 | PowerShell 轮询前台全屏窗口 | 不启用（检测实现依赖 Win32 API），快捷键恒可用 |
| 开机自启 | electron-auto-launch，失败回退原生 HKCU 项 | Electron 原生登录项（系统登录项不携带命令行参数，登录后正常开主窗口） |
| 应用图标 | `resources/icon.ico`（多尺寸） | `resources/icon.icns`（macOS 上由 `node scripts/make-icons.mjs` 生成） |
| 应用内更新 | electron-updater + NSIS，完整可用 | 未接入：分发的是未签名 zip，要做自动更新需先 Apple 签名 + 公证（`latest-mac.yml`） |

## 优先级算法

实现在 `shared/priority.ts`（独立模块，可单独调参与测试），全部权重显式声明：

```
总分 = 重要度(0/12/28) + 紧急度(0/10/22)
     + 截止分(逾期 30+2/天[封顶12]，24h内 26，3天内 18，7天内 12，14天内 6，更远 2，无 0)
     + 陈旧分(min(10, 0.6/天)) + 置顶(+1000)
```

分数只用于排序与 Today 分档，不主导界面呈现。已完成/已归档任务统一沉底。
单元测试见 `tests/priority.test.ts`（评分与权重）、`tests/model.test.ts`（象限映射、收件箱归属、Today 分档）与 `tests/board.test.ts`（白板坐标系、自动排布与避让）。

## 基本架构

```
shared/               类型与纯逻辑（渲染/主进程共用，不依赖 Electron）
  types.ts            任务/步骤/筛选等数据模型
  ipc.ts              IPC 通道名与 API 签名（preload 桥接的契约）
  platform.ts         平台判定 + 快速捕获快捷键的 accelerator / 展示文案
  priority.ts         优先级评分（含单元测试）
  board.ts            白板坐标系：位置 <-> 象限/等级、象限中心、自动排布与重叠避让
  quadrant.ts         象限文案/配色元数据（仅用于命名与兼容）
electron/main/        主进程
  index.ts            应用生命周期、全局快捷键、单实例、冒烟测试
  windows.ts          主窗口（无边框 / mac 原生交通灯）与快速捕获小窗、窗口状态持久化
  menu.ts             macOS 应用菜单（Edit role 是 ⌘C/⌘V 生效的前提）
  tray.ts             系统托盘
  db.ts               SQLite 建表/迁移 + 全部 CRUD（含 spaces 表与任务归属）
  prefs.ts            本地偏好（主题、当前空间）读写与原生主题同步
  ipc.ts              ipcMain.handle 注册（类型化小接口）
electron/preload/     contextBridge 暴露 window.api / window.capture
  theme.ts            首帧主题快照（避免闪烁）+ 主题变更广播
src/                  渲染进程 (React)
  store/todos.ts      Zustand 全局状态（列表、选中、筛选、撤销、当前空间）
  lib/visible.ts      各视图列表计算（收件箱/今天/白板/全部，按空间硬过滤）
  lib/space.tsx       空间图标 / 颜色元数据（key 存库，展示层映射）
  components/
    task/             TaskCard（统一卡片语言）、PriorityPicker（2D）、DuePicker、InlineSteps
    views/            InboxView / TodayView / Whiteboard / AllView
    detail/           DetailPanel（渐进披露属性行 + 步骤 + 备注 + 更多 + 空间）
    layout/           Sidebar / TitleBar / SpaceSwitcher / SettingsDialog
    theme/            ThemeProvider / ThemeSwitcher
    ui/               shadcn/ui 组件（Radix 原语）
```

- 关闭主窗口 = 最小化到托盘；托盘菜单可打开主窗口、快速捕获或退出。
- 主窗口与捕获窗口职责分离：捕获窗口只做一件事——保存标题到收件箱（命令面板风格）。

## 构建与打包

```bash
npm run build      # 只构建：产物在 app-build/（main / preload / renderer）
npm run package    # 构建 + 免安装版：forge-dist/<产品名>-<平台>-<arch>/ 内的可执行文件
npm run make       # 构建 + 分发包（maker 按当前平台自动筛）：
                   #   Windows → forge-dist/make/nsis/make/pinflow-<版本>-setup.exe
                   #   macOS   → forge-dist/make/zip/darwin/<arch>/PinFlow-darwin-<arch>-<版本>.zip
```

打包走 Electron Forge（`forge.config.js`）：

- `outDir: forge-dist` —— Forge 输出目录；electron-vite 输出到 `app-build/`，避开 Forge 硬编码忽略根目录 `out/` 的规则。
- `packagerConfig.asar: true` + `plugin-auto-unpack-natives` —— 原生模块 `better_sqlite3.node` 自动从 asar 解包。
- `plugin-fuses` —— 关闭 `RunAsNode` / Node CLI 参数、开启 asar 完整性校验（打包期固化，不依赖签名）。
- NSIS 向导式安装（`@felixrieseberg/electron-forge-maker-nsis`，`platforms: ['win32']`）：
  中文向导 + 许可页 + 可选安装目录；仅当前用户安装（不需要管理员），卸载时**保留用户数据**。
- macOS 分发用 `maker-zip`（`platforms: ['darwin']`），产出 `PinFlow.app` 的压缩包；
  maker 的 `platforms` 必须显式写，否则在 mac 上跑 `make` 也会去拉 NSIS 引擎然后失败。
- `updater` 配置 —— 同时生成随包分发的 `resources/app-update.yml` 与安装包旁的 `latest.yml`，
  这两份文件是应用内更新的依据（详见下文）。
- 不做代码签名：Windows 安装包首次运行会被 SmartScreen 提示；macOS 的 app 从 zip 解出来
  首次打开需要「右键 → 打开」（或 `xattr -dr com.apple.quarantine <app>`），都属正常现象。
- 应用图标按平台取：Windows 用 `resources/icon.ico`，macOS 用 `resources/icon.icns`
  （在 mac 上执行 `node scripts/make-icons.mjs` 生成，依赖系统自带的 `iconutil`）。

构建前请确保 `node scripts/fetch-native.mjs` 已成功（better-sqlite3 使用
`electron-v130` 预编译版本，与 Electron 33 匹配）。原生模块不做源码重建，无 MSVC 也能打包。

## 应用内更新与版本发布

客户端内置更新检测与一键升级：启动后静默检查一次，也可在 **设置 → 更新** 或
**托盘右键 → 「检查更新…」** 手动触发；发现新版本由用户确认后下载，装完自动重启。

- 更新源是 Cloudflare R2 上的一个 `latest.yml`，**客户端不需要任何密钥**（代码库保持私有，安装包公开可下载）。
- 更新源地址在构建时由 `UPDATE_BASE_URL` 注入，写进包内的 `app-update.yml`，**换 CDN 需要重新发版**。
- 免安装版（`npm run package`）与源码态（`npm run dev`）没有 `app-update.yml`，会如实显示「不支持自动更新」。

发版只需一条命令（版本号规则、首次配置 R2 与 GitHub 变量/密钥、排障手册见 **[docs/RELEASE.md](docs/RELEASE.md)**）：

```bash
npm run release:patch      # 或 release:minor / release:major
git push --follow-tags     # 触发 GitHub Actions 构建并上传更新源
```

## 路线图（MVP 之后）

- 快速捕获语法解析（`明天`, `!高`, `#标签`）
- 任务回收站、循环任务、通知提醒
- 多显示器捕获窗记忆
