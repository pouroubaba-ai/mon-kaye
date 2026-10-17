import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Composant shadcn/ui « Chart » (ChartContainer, ChartTooltip, ChartTooltipContent),
// repris de la source officielle, en version simplifiée pour les graphiques en anneau.

const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> })
}

type ChartContextProps = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart must be used within a <ChartContainer />")
  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, c]) => c.theme || c.color)
  if (!colorConfig.length) return null
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

type TooltipItem = { name?: string | number; value?: number | string; payload?: { fill?: string } }

function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: React.ReactNode
  formatter?: (value: number) => string
}) {
  const { config } = useChart()
  // On n'affiche que les séries déclarées dans la configuration
  // (ce qui exclut, par exemple, le fond gris des anneaux).
  const known = (payload ?? []).filter(item => {
    const n = String(item.name ?? "")
    const d = String((item as { dataKey?: string }).dataKey ?? "")
    return Boolean(config[n] || config[d])
  })
  if (!active || !known.length) return null
  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {label !== undefined && label !== '' && <div className="font-medium">{label}</div>}
      {known.map((item, i) => {
        // Le libellé vient de la configuration : par le nom de la part (anneaux)
        // ou, à défaut, par la série (barres).
        const name = String(item.name ?? "")
        const dataKey = String((item as { dataKey?: string }).dataKey ?? "")
        const key = config[name] ? name : dataKey
        const label = config[key]?.label ?? name
        const swatch = config[key]?.color ?? (item as { color?: string }).color ?? item.payload?.fill
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: swatch }} />
            <span className="text-muted-foreground">{label}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">
              {formatter ? formatter(Number(item.value)) : String(item.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartStyle }
