import { useState } from 'react'
import { CalendarDays, Clock, X } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { toLocalInput } from '@/lib/date'

const PRESETS: { label: string; at: () => Date }[] = [
  {
    label: '今天 18:00',
    at: () => {
      const d = new Date()
      d.setHours(18, 0, 0, 0)
      return d
    }
  },
  {
    label: '明天 09:00',
    at: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      return d
    }
  },
  {
    label: '本周末',
    at: () => {
      const d = new Date()
      d.setDate(d.getDate() + (6 - d.getDay() + 7) % 7)
      d.setHours(18, 0, 0, 0)
      return d
    }
  },
  {
    label: '下周',
    at: () => {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      d.setHours(9, 0, 0, 0)
      return d
    }
  }
]

/** 截止时间选择：一次点击即可设定，无需打开完整表单 */
export function DuePicker({
  value,
  onChange,
  children,
  align = 'start'
}: {
  value: string | null
  onChange: (iso: string | null) => void
  children?: React.ReactNode
  align?: 'start' | 'center' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>(value ? new Date(value) : undefined)
  const [time, setTime] = useState(
    value
      ? toLocalInput(value).slice(11, 16)
      : '18:00'
  )

  const commit = (next: Date | null) => {
    onChange(next ? next.toISOString() : null)
    setOpen(false)
  }

  const pickDate = (d: Date | undefined) => {
    if (!d) return
    const next = new Date(d)
    const [h, m] = time.split(':').map(Number)
    next.setHours(h ?? 18, m ?? 0, 0, 0)
    setDate(next)
    commit(next)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setDate(value ? new Date(value) : undefined)
          setTime(value ? toLocalInput(value).slice(11, 16) : '18:00')
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-[248px] p-1.5">
        <div className="grid grid-cols-2 gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => commit(p.at())}
              className="rounded-md border border-border px-2 py-1 text-left text-[12px] transition-colors hover:bg-accent"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="my-1.5 h-px bg-border" />

        <Calendar
          mode="single"
          selected={date}
          onSelect={pickDate}
          defaultMonth={date ?? new Date()}
          className="w-full"
        />

        <div className="mt-1.5 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value)
              if (date && e.target.value) {
                const [h, m] = e.target.value.split(':').map(Number)
                const next = new Date(date)
                next.setHours(h, m, 0, 0)
                setDate(next)
                commit(next)
              }
            }}
            className="h-7 flex-1 text-[12px]"
          />
          {value && (
            <Button variant="ghost" size="icon-sm" title="清除截止时间" onClick={() => commit(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** 卡片上的截止指示（语义色克制：逾期 / 临近 / 普通） */
export function DueBadge({
  value,
  tone,
  className,
  label
}: {
  value: string
  tone: 'overdue' | 'soon' | 'normal' | 'none'
  className?: string
  label: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1 py-px text-2xs',
        tone === 'overdue' && 'bg-destructive/10 text-destructive',
        tone === 'soon' && 'bg-warn-soft text-warn',
        tone === 'normal' && 'text-muted-foreground',
        className
      )}
      title={`截止：${value}`}
    >
      <CalendarDays className="h-3 w-3" />
      {label}
    </span>
  )
}
