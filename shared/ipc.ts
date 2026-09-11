import type {
  AppPrefs,
  CreateSpaceInput,
  CreateTodoInput,
  Quadrant,
  Space,
  SpaceDeleteResult,
  ShortcutState,
  Step,
  ThemeMode,
  Todo,
  UpdateSpaceInput,
  UpdateStatus,
  UpdateTodoInput
} from './types'

/** 主进程 <-> 渲染进程 的 IPC 通道名 */
export const IPC = {
  TODOS_LIST: 'todos:list',
  TODOS_CREATE: 'todos:create',
  TODOS_UPDATE: 'todos:update',
  TODOS_DELETE: 'todos:delete',
  TODOS_TOGGLE: 'todos:toggle',
  TODOS_SET_QUADRANT: 'todos:setQuadrant',
  TODOS_SET_POSITION: 'todos:setPosition',
  /** 批量写入白板坐标（「整理」用）：一个事务写完，只广播一次 */
  TODOS_SET_POSITIONS: 'todos:setPositions',
  /** 撤销删除：整行原样恢复（含原 id / 创建时间 / 状态 / 步骤） */
  TODOS_RESTORE: 'todos:restore',
  TODOS_REORDER: 'todos:reorder',
  TODOS_ADD_TAG: 'todos:addTag',
  TODOS_REMOVE_TAG: 'todos:removeTag',
  TODOS_ALL_TAGS: 'todos:allTags',

  SPACES_LIST: 'spaces:list',
  SPACES_CREATE: 'spaces:create',
  SPACES_UPDATE: 'spaces:update',
  SPACES_DELETE: 'spaces:delete',

  STEPS_ADD: 'steps:add',
  STEPS_UPDATE: 'steps:update',
  STEPS_DELETE: 'steps:delete',
  STEPS_TOGGLE: 'steps:toggle',

  APP_DB_PATH: 'app:dbPath',
  APP_OPEN_DB_DIR: 'app:openDbDir',
  APP_QUIT: 'app:quit',
  APP_WIN_MIN: 'app:winMin',
  APP_GET_VERSION: 'app:version',
  APP_OPEN_EXTERNAL: 'app:openExternal',
  APP_WIN_MAX: 'app:winMax',
  APP_WIN_CLOSE: 'app:winClose',
  APP_SET_AUTO_LAUNCH: 'app:setAutoLaunch',
  APP_GET_AUTO_LAUNCH: 'app:getAutoLaunch',
  APP_GET_PREFS: 'app:getPrefs',
  APP_SET_THEME: 'app:setTheme',
  APP_SET_ACTIVE_SPACE: 'app:setActiveSpace',
  /** 快速捕获快捷键开关 / 全屏屏蔽开关 / 运行时状态 */
  APP_SET_CAPTURE_SHORTCUT: 'app:setCaptureShortcut',
  APP_SET_FULLSCREEN_GUARD: 'app:setFullscreenGuard',
  APP_GET_SHORTCUT_STATE: 'app:getShortcutState',
  /** 应用内更新：取状态 / 检查 / 下载 / 退出并安装 */
  APP_UPDATE_STATUS: 'app:updateStatus',
  APP_UPDATE_CHECK: 'app:updateCheck',
  APP_UPDATE_DOWNLOAD: 'app:updateDownload',
  APP_UPDATE_INSTALL: 'app:updateInstall',
  /** 主进程 -> 渲染进程：更新状态变化（阶段 / 进度 / 错误） */
  UPDATE_STATUS_CHANGED: 'app:updateStatusChanged',
  /** 主进程 -> 渲染进程：偏好变更（托盘菜单也会改，需双向同步） */
  PREFS_CHANGED: 'app:prefsChanged',

  CAPTURE_CLOSE: 'capture:close',
  CAPTURE_SUBMIT: 'capture:submit',
  /** 主进程 -> 渲染进程：数据发生变更，需要刷新 */
  DATA_CHANGED: 'data:changed',
  /** 设置里的「清除所有数据」：任务/步骤全删，空间重置为默认 */
  DATA_CLEAR_ALL: 'data:clearAll',
  /** 主进程 -> 渲染进程：请求打开新建任务输入框 */
  REQUEST_NEW_TASK: 'app:newTask',
  /** 主进程 -> 渲染进程：快速捕获窗口准备就绪 */
  CAPTURE_READY: 'capture:ready'
} as const

/** 主窗口渲染进程可用 API */
export interface TodoApi {
  listTodos(): Promise<Todo[]>
  createTodo(input: CreateTodoInput): Promise<Todo>
  updateTodo(input: UpdateTodoInput): Promise<Todo>
  deleteTodo(id: string): Promise<boolean>
  toggleTodo(id: string): Promise<Todo>
  setQuadrant(id: string, quadrant: Quadrant): Promise<Todo>
  setPosition(id: string, x: number, y: number): Promise<Todo>
  /** 批量写入白板坐标，返回变更后的完整列表 */
  setPositions(items: { id: string; x: number; y: number }[]): Promise<Todo[]>
  /** 撤销删除：整行原样恢复，返回恢复后的任务 */
  restoreTodo(todo: Todo): Promise<Todo>
  reorderTodos(orderedIds: string[]): Promise<Todo[]>
  addTag(id: string, tag: string): Promise<Todo>
  removeTag(id: string, tag: string): Promise<Todo>
  /** 当前空间内的标签（传 null 表示全部） */
  allTags(spaceId?: string | null): Promise<string[]>

  listSpaces(): Promise<Space[]>
  createSpace(input: CreateSpaceInput): Promise<Space>
  updateSpace(id: string, patch: UpdateSpaceInput): Promise<Space>
  deleteSpace(id: string, moveToId?: string): Promise<SpaceDeleteResult>
  /** 清除全部数据并重置空间（设置里的危险区，需二次确认） */
  clearAllData(): Promise<void>

  addStep(todoId: string, title: string): Promise<Step>
  updateStep(stepId: string, patch: Partial<Pick<Step, 'title' | 'completed'>>): Promise<Step>
  deleteStep(stepId: string): Promise<boolean>
  toggleStep(stepId: string): Promise<Step>

  dbPath(): Promise<string>
  openDbDir(): Promise<void>
  /** 应用版本号（设置里的 info 区展示） */
  getVersion(): Promise<string>
  /** 打开外部链接（仅放行 https，防止渲染进程被用来拉起任意协议） */
  openExternal(url: string): Promise<void>
  quitApp(): Promise<void>
  minimizeWindow(): Promise<void>
  toggleMaximizeWindow(): Promise<void>
  closeWindow(): Promise<void>
  getAutoLaunch(): Promise<boolean>
  setAutoLaunch(enabled: boolean): Promise<boolean>
  getPrefs(): Promise<AppPrefs>
  setTheme(theme: ThemeMode): Promise<AppPrefs>
  setActiveSpace(id: string | null): Promise<AppPrefs>
  /** 启用/停用全局快速捕获快捷键 */
  setCaptureShortcut(enabled: boolean): Promise<AppPrefs>
  /** 全屏程序时是否自动屏蔽快捷键（防游戏误触） */
  setFullscreenGuard(enabled: boolean): Promise<AppPrefs>
  /** 快捷键运行时状态：是否真的注册上、是否被全屏临时屏蔽 */
  getShortcutState(): Promise<ShortcutState>
  /** 当前更新状态（打开设置时先渲染，再靠 onUpdateStatus 跟进） */
  getUpdateStatus(): Promise<UpdateStatus>
  /** 主动检查更新（托盘菜单与设置里的「检查更新」都走这里） */
  checkForUpdates(): Promise<UpdateStatus>
  /** 下载已发现的新版本 */
  downloadUpdate(): Promise<UpdateStatus>
  /** 退出应用并静默安装已下载的版本 */
  installUpdate(): Promise<void>
  /** 订阅更新状态变化 */
  onUpdateStatus(cb: (status: UpdateStatus) => void): () => void
  /** 订阅偏好变更（托盘右键菜单里的开关同样会触发） */
  onPrefsChanged(cb: (prefs: AppPrefs) => void): () => void
  /** 订阅「数据已变更」（来自快速捕获窗口等） */
  onDataChanged(cb: () => void): () => void
  /** 订阅「新建任务」请求（系统托盘菜单） */
  onNewTask(cb: () => void): () => void
  /** 首帧主题快照（preload 同步注入，避免主题闪烁） */
  themeSnapshot: { mode: ThemeMode; resolved: 'light' | 'dark' }
}

/** 快速捕获窗口渲染进程可用 API */
export interface CaptureApi {
  submit(title: string): Promise<void>
  close(): Promise<void>
  onReady(cb: () => void): () => void
}

declare global {
  interface Window {
    api: TodoApi
    capture: CaptureApi
  }
}
