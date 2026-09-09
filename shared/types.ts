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

/** 任务主体 */
export interface Todo {
  id: string
  title: string
  notes: string
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
}

/** 创建任务入参：只需要标题 */
export interface CreateTodoInput {
  title: string
  notes?: string
  importance?: Level
  urgency?: Level
  dueAt?: string | null
  status?: TodoStatus
  tags?: string[]
  pinned?: boolean
  classified?: boolean
}

/** 更新任务入参（只传需要改的字段） */
export interface UpdateTodoInput extends Partial<CreateTodoInput> {
  id: string
  completedAt?: string | null
  archived?: never
}

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'system'

/** 本地偏好设置（存于 userData/prefs.json，跨窗口共享） */
export interface AppPrefs {
  theme: ThemeMode
}

/** 四象限编号：1 重要紧急 / 2 重要不紧急 / 3 不重要紧急 / 4 不重要不紧急 */
export type Quadrant = 1 | 2 | 3 | 4

export interface QuadrantValue {
  importance: Level
  urgency: Level
}

/** 主窗口视图 */
export type ViewKey = 'inbox' | 'today' | 'kanban' | 'all'

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
