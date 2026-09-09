import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-2', className)}
      formatters={{
        formatCaption: (date) => `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`,
        formatWeekdayName: (date) => '日一二三四五六'[date.getDay()]
      }}
      classNames={{
        months: 'flex flex-col gap-3',
        month: 'space-y-2',
        caption: 'relative flex items-center justify-center pt-1',
        caption_label: 'text-[13px] font-medium',
        nav: 'flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'absolute h-6 w-6 text-muted-foreground'
        ),
        nav_button_previous: 'left-1',
        nav_button_next: 'right-1',
        table: 'w-full border-collapse',
        head_row: 'flex',
        head_cell: 'w-8 text-2xs font-normal text-muted-foreground',
        row: 'mt-1 flex w-full',
        cell: 'p-0',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 text-[12px] font-normal aria-selected:opacity-100'
        ),
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'text-primary font-medium',
        day_outside: 'text-muted-foreground/50',
        day_disabled: 'text-muted-foreground/40',
        day_hidden: 'invisible',
        ...classNames
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-3.5 w-3.5" />,
        IconRight: () => <ChevronRight className="h-3.5 w-3.5" />
      }}
      {...props}
    />
  )
}

export { Calendar }
