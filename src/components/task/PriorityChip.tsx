import { pointOf, quadrantAt } from '@shared/board'
import { QUADRANT_META } from '@shared/quadrant'
import type { Todo } from '@shared/types'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PriorityPicker } from '@/components/task/PriorityPicker'
import { useTodos } from '@/store/todos'

/**
 * 卡片上的优先级入口：一个安静的小圆点 + 区域名，
 * 点开就是与白板同一套坐标系的 2D 选择器。
 */
export function PriorityChip({
  todo,
  className,
  withText = true
}: {
  todo: Todo
  className?: string
  withText?: boolean
}) {
  const setPosition = useTodos((s) => s.setPosition)
  const point = pointOf(todo)
  const zone = QUADRANT_META[quadrantAt(point ?? { x: 0.5, y: 0.62 })]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex items-center gap-1 rounded px-1 py-px text-2xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            className
          )}
          title={point ? `${zone.title} · 点击调整` : '待归类 · 点击放到白板上'}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: zone.dotVar }} />
          {withText && (point ? zone.title : '待归类')}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="pb-1.5 text-2xs text-muted-foreground">优先级</div>
        <PriorityPicker
          value={point}
          size={132}
          onChange={(p) => void setPosition(todo.id, p.x, p.y)}
        />
      </PopoverContent>
    </Popover>
  )
}
