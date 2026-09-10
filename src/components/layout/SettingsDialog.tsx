import { useEffect, useMemo, useState } from 'react'
import { Check, Database, Layers, Plus, Power, Trash2 } from 'lucide-react'
import { SPACE_COLORS, SPACE_ICONS } from '@shared/types'
import type { Space, SpaceColor, SpaceIcon } from '@shared/types'
import { useTodos } from '@/store/todos'
import { SPACE_COLOR_LABELS, SPACE_ICON_LABELS, SPACE_ICON_MAP, spaceColor } from '@/lib/space'
import { cn } from '@/lib/utils'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import * as DropdownMenu from '@/components/ui/dropdown-menu'

const SHORTCUT = 'Ctrl+Shift+Space'

export function SettingsDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [autoStart, setAutoStart] = useState(false)
  const [dbPath, setDbPath] = useState('')

  useEffect(() => {
    if (!open) return
    void window.api.getAutoLaunch().then(setAutoStart)
    void window.api.dbPath().then(setDbPath)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[76vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>本地优先，数据只存在这台电脑上</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <SpaceSection />

          <div className="h-px bg-border" />

          <div className="flex items-center justify-between">
            <span className="text-[13px]">外观</span>
            <ThemeSwitcher />
          </div>

          <div className="h-px bg-border" />

          <label className="flex cursor-pointer items-center justify-between">
            <span className="flex items-center gap-2 text-[13px]">
              <Power className="h-3.5 w-3.5 text-muted-foreground" />
              开机自动启动
            </span>
            <Checkbox
              checked={autoStart}
              onCheckedChange={(v) => {
                setAutoStart(v === true)
                void window.api.setAutoLaunch(v === true)
              }}
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px]">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              数据库位置
            </span>
            <button
              onClick={() => void window.api.openDbDir()}
              className="max-w-[240px] truncate rounded px-1.5 py-0.5 font-mono text-2xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={dbPath}
            >
              {dbPath || '…'}
            </button>
          </div>

          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">快速捕获</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
              {SHORTCUT}
            </kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 空间：把不同生活面的任务彻底分开 */
function SpaceSection() {
  const spaces = useTodos((s) => s.spaces)
  const todos = useTodos((s) => s.todos)
  const activeSpaceId = useTodos((s) => s.activeSpaceId)
  const setActiveSpace = useTodos((s) => s.setActiveSpace)
  const createSpace = useTodos((s) => s.createSpace)
  const updateSpace = useTodos((s) => s.updateSpace)
  const deleteSpace = useTodos((s) => s.deleteSpace)

  const [name, setName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of todos) map.set(t.spaceId, (map.get(t.spaceId) ?? 0) + 1)
    return map
  }, [todos])

  const add = async () => {
    const v = name.trim()
    if (!v) return
    setName('')
    await createSpace({
      name: v,
      icon: SPACE_ICONS[(spaces.length + 2) % SPACE_ICONS.length],
      color: SPACE_COLORS[spaces.length % SPACE_COLORS.length]
    })
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[13px] font-medium">空间</h3>
        <span className="text-2xs text-muted-foreground">工作与生活分开记</span>
      </div>

      <div className="space-y-1">
        {spaces.map((s) => {
          const count = counts.get(s.id) ?? 0
          const last = spaces.length <= 1
          const confirming = confirmId === s.id
          return (
            <div
              key={s.id}
              className={cn(
                'flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors',
                s.id === activeSpaceId ? 'border-primary/50 bg-primary/[0.06]' : 'border-border'
              )}
            >
              <IconColorMenu
                space={s}
                onPick={(patch) => void updateSpace(s.id, patch)}
              />
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
              <span className="shrink-0 font-mono text-2xs text-muted-foreground">{count}</span>

              {s.id !== activeSpaceId && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => void setActiveSpace(s.id)}
                >
                  切换
                </Button>
              )}

              {confirming ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 text-destructive"
                  disabled={last}
                  title={last ? '至少保留一个空间' : `删除后其中 ${count} 项任务会移到其它空间`}
                  onClick={() => {
                    setConfirmId(null)
                    void deleteSpace(s.id)
                  }}
                >
                  确认删除
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
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add()
          }}
          placeholder="新建空间，例如「家庭」"
          className="h-7 flex-1 text-[12px]"
        />
        <Button variant="secondary" size="sm" disabled={!name.trim()} onClick={() => void add()}>
          <Plus className="h-3.5 w-3.5" />
          新建
        </Button>
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
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: spaceColor(c) }}
              >
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
