/** 重要程度 / 紧急程度 */
export type Level = 'low' | 'normal' | 'high'

/** 任务状态 */
export type TodoStatus = 'active' | 'completed' | 'archived'

/** 步骤 / 子任务 */
export interface Step {
  id: string
  todoId: string
  title: string
  completed: boolean
  order: number
}

/* ------------------------------ 空间 ------------------------------ */
/** 空间 = 一整套任务的归属（工作 / 生活…）。所有视图都只在当前空间内工作 */
export type SpaceIcon =
  | 'briefcase'
  | 'home'
  | 'heart'
  | 'star'
  | 'rocket'
  | 'book'
  | 'coffee'
  | 'folder'

export type SpaceColor = 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'slate'

export const SPACE_ICONS: SpaceIcon[] = [
  'briefcase',
  'home',
  'heart',
  'star',
  'rocket',
  'book',
  'coffee',
  'folder'
]

export const SPACE_COLORS: SpaceColor[] = ['blue', 'green', 'amber', 'rose', 'violet', 'slate']

export interface Space {
  id: string
  name: string
  icon: SpaceIcon
  color: SpaceColor
  /** 排序（越小越靠前） */
  order: number
  createdAt: string
}

export interface CreateSpaceInput {
  name: string
  icon?: SpaceIcon
  color?: SpaceColor
}

export interface UpdateSpaceInput {
  name?: string
  icon?: SpaceIcon
  color?: SpaceColor
}

/** 删除空间的结果：其中的任务会被搬走而不是被删掉 */
export interface SpaceDeleteResult {
  removed: boolean
  movedTo: string | null
  movedCount: number
}

/** 任务主体 */
export interface Todo {
  id: string
  title: string
  notes: string
  /** 所属空间 */
  spaceId: string
  /** 内部评分用；用户面向的分类是「象限」，象限自动推导这两个值 */
  importance: Level
  urgency: Level
  /** ISO 字符串，未设置时为 null */
  dueAt: string | null
  status: TodoStatus
  createdAt: string
  updatedAt: string
  completedAt: string | null
  tags: string[]
  /** 手动置顶 */
  pinned: boolean
  /** 是否已明确分类（false = 未分类，留在收件箱） */
  classified: boolean
  /** 列表内排序（越小越靠前） */
  order: number
  steps: Step[]
  /**
   * 白板坐标（0..1 归一化，null = 尚未放到白板上）。
   * x：0 = 最紧急（左），1 = 最不紧急（右）
   * y：0 = 最重要（上），1 = 最不重要（下）
   */
  boardX: number | null
  boardY: number | null
}

/** 创建任务入参：只需要标题（空间缺省为当前空间） */
export interface CreateTodoInput {
  title: string
  notes?: string
  spaceId?: string
  importance?: Level
  urgency?: Level
  dueAt?: string | null
  status?: TodoStatus
  tags?: string[]
  pinned?: boolean
  classified?: boolean
  boardX?: number | null
  boardY?: number | null
}

/** 更新任务入参（只传需要改的字段） */
export interface UpdateTodoInput extends Partial<CreateTodoInput> {
  id: string
  completedAt?: string | null
  archived?: never
  /** 移动任务到另一个空间 */
  spaceId?: string
  /**
   * 静默更新：不刷新 updated_at。
   * 白板拖动属于「摆放」而非编辑，若每次都刷新 updated_at，
   * 「按更新时间排序」就会退化成「按最后一次拖动排序」。
   */
  silent?: boolean
}

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'system'

/** 本地偏好设置（存于 userData/prefs.json，跨窗口共享） */
export interface AppPrefs {
  theme: ThemeMode
  /** 当前空间；为 null 时自动取第一个空间 */
  activeSpaceId: string | null
  /** 是否启用全局快速捕获快捷键（默认开） */
  captureShortcut: boolean
  /** 运行全屏程序时自动屏蔽快速捕获快捷键，防游戏误触（默认开） */
  fullscreenGuard: boolean
}

/** 快速捕获快捷键的运行时状态（设置里用它提示"被占用/已临时屏蔽"） */
export interface ShortcutState {
  /** 用户是否开启了这个快捷键 */
  enabled: boolean
  /** 当前是否真的注册上了（被别的程序占用时为 false） */
  registered: boolean
  /** 是否因为前台是全屏程序而被临时屏蔽 */
  suspendedByFullscreen: boolean
}

/** 应用内更新的阶段机：由主进程维护并广播，渲染层只做展示 */
export type UpdatePhase =
  | 'idle' // 还没检查过
  | 'checking' // 正在向更新源查询
  | 'available' // 查到新版本，等待用户确认下载
  | 'not-available' // 已是最新
  | 'downloading' // 下载安装包中
  | 'downloaded' // 下载完成，等待重启安装
  | 'error' // 检查或下载失败

export interface UpdateStatus {
  phase: UpdatePhase
  /** 当前运行的版本 */
  currentVersion: string
  /** 新版本号（available / downloading / downloaded 时才有） */
  version: string | null
  /** 下载进度百分比 0-100（仅 downloading） */
  percent: number
  /** 失败原因（仅 error） */
  message: string | null
  /**
   * 更新功能是否可用。
   * 开发态（npm run dev）没有 app-update.yml，或构建时未配置更新源时为 false。
   */
  enabled: boolean
}

/** 四象限编号：1 重要紧急 / 2 重要不紧急 / 3 不重要紧急 / 4 不重要不紧急 */
export type Quadrant = 1 | 2 | 3 | 4

export interface QuadrantValue {
  importance: Level
  urgency: Level
}

/** 主窗口视图 */
export type ViewKey = 'inbox' | 'today' | 'board' | 'all'

/** 全部筛选条件（All 视图） */
export interface TodoFilter {
  keyword: string
  status: 'all' | 'active' | 'completed' | 'archived'
  tag: string | null
  dueRange: 'all' | 'overdue' | 'today' | 'week' | 'none'
  sort: 'priority' | 'created' | 'updated' | 'due'
}

export const EMPTY_FILTER: TodoFilter = {
  keyword: '',
  status: 'all',
  tag: null,
  dueRange: 'all',
  sort: 'priority'
}
