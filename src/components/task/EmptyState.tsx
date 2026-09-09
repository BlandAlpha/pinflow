export function EmptyState({
  title,
  description,
  hint
}: {
  title: string
  description?: string
  hint?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-16 text-center">
      <div className="text-[13px] font-medium">{title}</div>
      {description && (
        <div className="max-w-xs text-2xs text-muted-foreground">{description}</div>
      )}
      {hint && (
        <kbd className="mt-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
          {hint}
        </kbd>
      )}
    </div>
  )
}
