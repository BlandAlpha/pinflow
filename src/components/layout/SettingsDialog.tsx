import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Database,
  Download,
  Gamepad2,
  Github,
  Heart,
  Keyboard,
  Layers,
  Plus,
  Power,
  RefreshCw,
  Trash2
} from 'lucide-react'
import { SPACE_COLORS, SPACE_ICONS } from '@shared/types'
import type {
  AppPrefs,
  ShortcutState,
  Space,
  SpaceColor,
  SpaceIcon,
  UpdateStatus
} from '@shared/types'
import { useTodos } from '@/store/todos'
import { SPACE_COLOR_LABELS, SPACE_ICON_LABELS, SPACE_ICON_MAP, spaceColor } from '@/lib/space'
import { CAPTURE_SHORTCUT_LABEL } from '@/lib/shortcut'
import { cn } from '@/lib/utils'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import * as DropdownMenu from '@/components/ui/dropdown-menu'

/** 显示文案跟着平台走：macOS 上注册的其实是 ⌘⇧Space（CommandOrControl） */
const SHORTCUT = CAPTURE_SHORTCUT_LABEL
/** 「全屏程序时屏蔽快捷键」依赖 Win32 API 检测前台全屏窗口，macOS 上不启用 */
const isMac = window.api?.platform === 'darwin'
const GITHUB_URL = 'https://github.com/BlandAlpha'

/** 打开设置时先用它渲染，拿到主进程偏好后立刻覆盖（避免首帧空白） */
const FALLBACK_PREFS: AppPrefs = {
  theme: 'system',
  activeSpaceId: null,
  captureShortcut: true,
  fullscreenGuard: true
}

export function SettingsDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [autoStart, setAutoStart] = useState(false)
  const [dbPath, setDbPath] = useState('')
  const [version, setVersion] = useState('')
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [prefs, setPrefs] = useState<AppPrefs>(FALLBACK_PREFS)
  const [shortcutState, setShortcutState] = useState<ShortcutState | null>(null)
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const clearAll = useTodos((s) => s.clearAll)

  const refreshShortcutState = useCallback(async () => {
    setShortcutState(await window.api.getShortcutState())
  }, [])

  useEffect(() => {
    if (!open) return
    void window.api.getAutoLaunch().then(setAutoStart)
    void window.api.dbPath().then(setDbPath)
    void window.api.getVersion().then(setVersion)
    void window.api.getPrefs().then(setPrefs)
    void refreshShortcutState()
    void window.api.getUpdateStatus().then(setUpdate)
    // 托盘右键菜单也能改这两个开关，改完要同步到这里
    const offPrefs = window.api.onPrefsChanged((p) => {
      setPrefs(p)
      void refreshShortcutState()
    })
    // 检查/下载是异步的，进度靠主进程推过来（打开设置前可能就已经在下载了）
    const offUpdate = window.api.onUpdateStatus(setUpdate)
    return () => {
      offPrefs()
      offUpdate()
    }
  }, [open, refreshShortcutState])

  // 快捷键没生效时给出原因，避免"开关开着但按不出来"这种困惑
  const shortcutHint = !prefs.captureShortcut
    ? '已停用'
    : shortcutState?.suspendedByFullscreen
      ? '全屏中已屏蔽'
      : shortcutState && !shortcutState.registered
        ? '被其它程序占用'
        : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] w-full max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>本地优先，数据只存在这台电脑上</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <SpaceSection />

          <Group label="通用">
            <Row label="外观">
              <ThemeSwitcher />
            </Row>
            <Row icon={<Power className="h-3.5 w-3.5" />} label="开机自动启动">
              <Checkbox
                checked={autoStart}
                onCheckedChange={(v) => {
                  const next = v === true
                  setAutoStart(next)
                  // 以主进程返回的实际状态为准：写失败时复选框自动回滚
                  void window.api.setAutoLaunch(next).then(setAutoStart)
                }}
              />
            </Row>
            <Row icon={<Keyboard className="h-3.5 w-3.5" />} label="快速捕获">
              <div className="flex items-center gap-2">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                  {SHORTCUT}
                </kbd>
                <Checkbox
                  checked={prefs.captureShortcut}
                  onCheckedChange={(v) =>
                    void window.api
                      .setCaptureShortcut(v === true)
                      .then(setPrefs)
                      .then(() => refreshShortcutState())
                  }
                />
              </div>
            </Row>
            {!isMac && (
              <Row
                icon={<Gamepad2 className="h-3.5 w-3.5" />}
                label="全屏程序时屏蔽快捷键"
                hint={shortcutHint}
              >
                <Checkbox
                  checked={prefs.fullscreenGuard}
                  disabled={!prefs.captureShortcut}
                  onCheckedChange={(v) =>
                    void window.api.setFullscreenGuard(v === true).then((p) => {
                      setPrefs(p)
                      void refreshShortcutState()
                    })
                  }
                />
              </Row>
            )}
          </Group>

          <UpdateSection version={version} update={update} onStatus={setUpdate} />

          <Group label="数据">
            <Row
              icon={<Database className="h-3.5 w-3.5" />}
              label="数据库位置"
              hint={dbPath}
              onHintClick={() => void window.api.openDbDir()}
            />
            <button
              type="button"
              onClick={() => setConfirmWipe(true)}
              className="flex h-10 w-full items-center gap-2.5 px-3 text-[13px] text-destructive transition-colors hover:bg-destructive/[0.06]"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">清除所有数据</span>
              <span className="text-2xs font-normal text-destructive/60">不可撤销</span>
            </button>
          </Group>
        </div>

        <InfoFooter version={version} />

        {/* 二次确认：红色警示 + 显式按钮，避免一键误清全部数据 */}
        <Dialog open={confirmWipe} onOpenChange={setConfirmWipe}>
          <DialogContent className="max-w-sm p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </span>
              <div className="space-y-1.5">
                <DialogTitle>清除所有数据？</DialogTitle>
                <DialogDescription>
                  将永久删除所有空间中的全部任务与步骤，空间恢复为默认（工作 / 生活）。
                  此操作不可撤销。
                </DialogDescription>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirmWipe(false)}>
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setConfirmWipe(false)
                  void clearAll()
                  onOpenChange(false)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                全部清除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- 更新 ---------- */

/** 状态 -> 文案。集中在表里，避免 JSX 里塞一长串三元 */
function updateTexts(status: UpdateStatus | null): { title: string; detail: string } {
  if (!status) return { title: '检查更新', detail: '' }
  const detail = status.enabled ? '' : '开发版或免安装版不支持'
  switch (status.phase) {
    case 'checking':
      return { title: '正在检查更新…', detail: '' }
    case 'available':
      return { title: `发现新版本 v${status.version}`, detail: '' }
    case 'downloading':
      return { title: `正在下载更新 ${status.percent}%`, detail: '' }
    case 'downloaded':
      return { title: `v${status.version} 已下载`, detail: '重启后自动安装' }
    case 'not-available':
      return { title: '已是最新版本', detail: '' }
    case 'error':
      return { title: '检查更新失败', detail: status.message ?? '' }
    default:
      return { title: '检查更新', detail }
  }
}

/** 更新：状态 + 一个随状态变身的按钮，进度条只在下载时出现 */
function UpdateSection({
  version,
  update,
  onStatus
}: {
  version: string
  update: UpdateStatus | null
  onStatus: (s: UpdateStatus) => void
}) {
  const { title, detail } = updateTexts(update)
  const busy = update?.phase === 'checking' || update?.phase === 'downloading'
  const disabled = busy || update?.enabled === false

  const action =
    update?.phase === 'downloaded'
      ? { label: '重启并安装', run: () => void window.api.installUpdate() }
      : update?.phase === 'available'
        ? { label: '下载更新', run: () => void window.api.downloadUpdate().then(onStatus) }
        : { label: '检查更新', run: () => void window.api.checkForUpdates().then(onStatus) }

  return (
    <Group label="更新">
      <Row
        icon={<RefreshCw className="h-3.5 w-3.5" />}
        label="当前版本"
        hint={version ? `v${version}` : '…'}
      />
      <Row icon={<Download className="h-3.5 w-3.5" />} label={title} hint={detail}>
        <Button size="xs" variant="outline" disabled={disabled} onClick={action.run}>
          {action.label}
        </Button>
      </Row>
      {update?.phase === 'downloading' && (
        <div className="px-3 py-2">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${update.percent}%` }}
            />
          </div>
        </div>
      )}
    </Group>
  )
}

/* ---------- 版式基元：分组卡片 + 统一行高，制造节奏与层级 ---------- */

/** 小节：全大写弱化小标题 + 一张圆角卡片（行间用分隔线，不用裸 hr） */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="px-1 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
        {label}
      </h3>
      <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
        {children}
      </div>
    </section>
  )
}

/** 统一 40px 行：左图标 + 标签，右侧放控件或灰字说明 */
function Row({
  icon,
  label,
  hint,
  onHintClick,
  children
}: {
  icon?: ReactNode
  label: string
  /** 右侧灰字（数据库路径这类），可点击 */
  hint?: string
  onHintClick?: () => void
  children?: ReactNode
}) {
  return (
    <div className="flex h-10 items-center gap-2.5 px-3 text-[13px] transition-colors hover:bg-accent/30">
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && (
        <button
          type="button"
          onClick={onHintClick}
          title={hint}
          className={cn(
            'max-w-[200px] truncate rounded px-1 py-0.5 font-mono text-2xs text-muted-foreground',
            onHintClick && 'transition-colors hover:bg-accent hover:text-foreground'
          )}
        >
          {hint || '…'}
        </button>
      )}
      {children && (
        <div className="flex min-w-7 shrink-0 items-center justify-center">{children}</div>
      )}
    </div>
  )
}

/** 底部 info：版本号 · 作者 · GitHub 主页 */
function InfoFooter({ version }: { version: string }) {
  const openGitHub = () => void window.api.openExternal(GITHUB_URL)
  return (
    <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-border/60 pt-3 text-2xs text-muted-foreground">
      <span className="font-mono">{version ? `v${version}` : '…'}</span>
      <span className="text-border">·</span>
      <span className="inline-flex items-center gap-0.5">
        Made with
        <Heart className="h-3 w-3 -translate-y-px text-destructive" fill="currentColor" />
        by
      </span>
      <button
        type="button"
        onClick={openGitHub}
        className="font-medium text-foreground/80 transition-colors hover:text-foreground"
      >
        CanisAlpha
      </button>
      <button
        type="button"
        onClick={openGitHub}
        title="GitHub 主页"
        className="rounded p-0.5 transition-colors hover:bg-accent hover:text-foreground"
      >
        <Github className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ---------- 空间 ---------- */

/** 空间：把不同生活面的任务彻底分开 */
function SpaceSection() {
  const spaces = useTodos((s) => s.spaces)
  const todos = useTodos((s) => s.todos)
  const activeSpaceId = useTodos((s) => s.activeSpaceId)
  const setActiveSpace = useTodos((s) => s.setActiveSpace)
  const createSpace = useTodos((s) => s.createSpace)
  const updateSpace = useTodos((s) => s.updateSpace)
  const deleteSpace = useTodos((s) => s.deleteSpace)

  const [confirmId, setConfirmId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of todos) map.set(t.spaceId, (map.get(t.spaceId) ?? 0) + 1)
    return map
  }, [todos])

  // 新建不再要求先想名字：建出来是「新空间」，行内点击即可改名
  const add = () =>
    void createSpace({
      name: '新空间',
      icon: SPACE_ICONS[(spaces.length + 2) % SPACE_ICONS.length],
      color: SPACE_COLORS[spaces.length % SPACE_COLORS.length]
    })

  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline gap-2 px-1">
        <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
          <Layers className="mr-1 inline h-3 w-3 -translate-y-px" />
          空间
        </h3>
        <span className="text-2xs text-muted-foreground/70">工作与生活分开记</span>
      </div>

      <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
        {spaces.map((s) => {
          const count = counts.get(s.id) ?? 0
          const last = spaces.length <= 1
          const confirming = confirmId === s.id
          const active = s.id === activeSpaceId
          return (
            <div
              key={s.id}
              className={cn(
                'flex h-10 items-center gap-1.5 px-2.5 transition-colors',
                active ? 'bg-primary/[0.05]' : 'hover:bg-accent/30'
              )}
            >
              <IconColorMenu space={s} onPick={(patch) => void updateSpace(s.id, patch)} />
              <input
                key={`${s.id}-${s.name}`}
                defaultValue={s.name}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== s.name) void updateSpace(s.id, { name: v })
                  else e.target.value = s.name
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') {
                    ;(e.target as HTMLInputElement).value = s.name
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />

              {/* 切换放在计数之前，用图标不用文字，减轻视觉负担 */}
              {active ? (
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center text-primary"
                  title="当前空间"
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void setActiveSpace(s.id)}
                  title={`切换到「${s.name}」`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              <span className="w-6 shrink-0 text-right font-mono text-2xs text-muted-foreground">
                {count}
              </span>

              {confirming ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 shrink-0 px-1.5 text-destructive"
                  disabled={last}
                  title={last ? '至少保留一个空间' : `删除后 ${count} 项任务移到其它空间`}
                  onClick={() => {
                    setConfirmId(null)
                    void deleteSpace(s.id)
                  }}
                >
                  确认
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={last}
                  title={last ? '至少保留一个空间' : '删除空间'}
                  onClick={() => setConfirmId(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )
        })}

        {/* 新建：一个 + 按钮即可，名字建完再改 */}
        <button
          type="button"
          onClick={add}
          title="新建空间"
          className="flex h-9 w-full items-center justify-center text-muted-foreground/70 transition-colors hover:bg-accent/40 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}

/** 图标 + 颜色选择 */
function IconColorMenu({
  space,
  onPick
}: {
  space: Space
  onPick: (patch: { icon?: SpaceIcon; color?: SpaceColor }) => void
}) {
  return (
    <DropdownMenu.DropdownMenu>
      <DropdownMenu.DropdownMenuTrigger asChild>
        <button
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-accent"
          title="修改图标 / 颜色"
        >
          <span style={{ color: spaceColor(space.color) }}>
            {(() => {
              const Icon = SPACE_ICON_MAP[space.icon] ?? SPACE_ICON_MAP.folder
              return <Icon className="h-4 w-4" />
            })()}
          </span>
        </button>
      </DropdownMenu.DropdownMenuTrigger>
      <DropdownMenu.DropdownMenuContent align="start" className="w-48 p-2">
        <div className="mb-1 text-2xs text-muted-foreground">图标</div>
        <div className="grid grid-cols-4 gap-1">
          {SPACE_ICONS.map((key) => {
            const Icon = SPACE_ICON_MAP[key]
            const active = space.icon === key
            return (
              <button
                key={key}
                onClick={() => onPick({ icon: key })}
                title={SPACE_ICON_LABELS[key]}
                className={cn(
                  'flex h-7 items-center justify-center rounded border transition-colors',
                  active ? 'border-primary/60 bg-primary/10' : 'border-transparent hover:bg-accent'
                )}
              >
                <Icon
                  className="h-3.5 w-3.5"
                  style={{ color: active ? spaceColor(space.color) : undefined }}
                />
              </button>
            )
          })}
        </div>
        <div className="mb-1 mt-2 text-2xs text-muted-foreground">颜色</div>
        <div className="flex gap-1">
          {SPACE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onPick({ color: c })}
              title={SPACE_COLOR_LABELS[c]}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
                space.color === c ? 'border-foreground/40' : 'border-transparent hover:bg-accent'
              )}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: spaceColor(c) }}>
                {space.color === c && (
                  <Check className="h-3 w-3 text-background" strokeWidth={3.5} />
                )}
              </span>
            </button>
          ))}
        </div>
      </DropdownMenu.DropdownMenuContent>
    </DropdownMenu.DropdownMenu>
  )
}
