import {
  BookOpen,
  Briefcase,
  Coffee,
  Folder,
  Heart,
  Home,
  Rocket,
  Star,
  type LucideIcon
} from 'lucide-react'
import type { SpaceColor, SpaceIcon } from '@shared/types'

/** 空间图标 key -> 图标组件（key 本身存在数据库里，展示层负责映射） */
export const SPACE_ICON_MAP: Record<SpaceIcon, LucideIcon> = {
  briefcase: Briefcase,
  home: Home,
  heart: Heart,
  star: Star,
  rocket: Rocket,
  book: BookOpen,
  coffee: Coffee,
  folder: Folder
}

export const SPACE_ICON_LABELS: Record<SpaceIcon, string> = {
  briefcase: '工作',
  home: '家庭',
  heart: '兴趣',
  star: '重要',
  rocket: '项目',
  book: '学习',
  coffee: '杂事',
  folder: '通用'
}

export const SPACE_COLOR_LABELS: Record<SpaceColor, string> = {
  blue: '蓝',
  green: '绿',
  amber: '橙',
  rose: '红',
  violet: '紫',
  slate: '灰'
}

/** 空间色：走语义 CSS 变量，明暗主题自动适配 */
export function spaceColor(color: SpaceColor): string {
  return `hsl(var(--space-${color}))`
}

export function SpaceGlyph({
  icon,
  color,
  className
}: {
  icon: SpaceIcon
  color: SpaceColor
  className?: string
}) {
  const Icon = SPACE_ICON_MAP[icon] ?? Folder
  return <Icon className={className} style={{ color: spaceColor(color) }} />
}
