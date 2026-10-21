import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker"
import { fr } from "react-day-picker/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// Composant shadcn/ui « Calendar » (react-day-picker 9), repris de la source officielle,
// en français par défaut (lundi en premier, noms des mois et des jours en français).

function Calendar({ className, classNames, showOutsideDays = true, components, ...props }: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames()
  return (
    <DayPicker
      locale={fr}
      showOutsideDays={showOutsideDays}
      className={cn("group/calendar bg-transparent p-2 [--cell-size:2.25rem]", className)}
      classNames={{
        root: cn("w-fit", d.root),
        months: cn("relative flex flex-col gap-4", d.months),
        month: cn("flex w-full flex-col gap-3", d.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", d.nav),
        button_previous: cn(buttonVariants({ variant: "ghost" }), "size-(--cell-size) p-0 select-none aria-disabled:opacity-40", d.button_previous),
        button_next: cn(buttonVariants({ variant: "ghost" }), "size-(--cell-size) p-0 select-none aria-disabled:opacity-40", d.button_next),
        month_caption: cn("flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)", d.month_caption),
        caption_label: cn("text-sm font-medium capitalize select-none", d.caption_label),
        month_grid: "w-full border-collapse",
        weekdays: cn("flex", d.weekdays),
        weekday: cn("flex-1 rounded-md text-[0.8rem] font-normal capitalize text-muted-foreground select-none", d.weekday),
        week: cn("mt-1 flex w-full", d.week),
        day: cn("group/day relative aspect-square h-full w-full p-0 text-center select-none", d.day),
        range_start: cn("rounded-l-md bg-accent", d.range_start),
        range_middle: cn("rounded-none", d.range_middle),
        range_end: cn("rounded-r-md bg-accent", d.range_end),
        today: cn("rounded-md bg-accent text-accent-foreground data-[selected=true]:rounded-none", d.today),
        outside: cn("text-muted-foreground aria-selected:text-muted-foreground", d.outside),
        disabled: cn("text-muted-foreground opacity-40", d.disabled),
        hidden: cn("invisible", d.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...p }) =>
          orientation === "left" ? <ChevronLeftIcon className={cn("size-4", className)} {...p} /> : <ChevronRightIcon className={cn("size-4", className)} {...p} />,
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])
  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "flex aspect-square size-auto w-full min-w-(--cell-size) items-center justify-center rounded-md text-sm leading-none font-normal tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none",
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground",
        "data-[range-start=true]:rounded-md data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground",
        "data-[range-end=true]:rounded-md data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
