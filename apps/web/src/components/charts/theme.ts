/**
 * Chart colors, validated with the dataviz palette checker against the card
 * surface (#18181b, dark mode): the series lime is lime-600 because brighter
 * limes fall outside the dark-mode lightness band for data marks. Buttons keep
 * the brighter lime-400 accent.
 */
export const chartTheme = {
  surface: '#18181b', // zinc-900, the Card background; used for marker rings
  grid: '#27272a', // zinc-800, one step off the surface
  crosshair: '#52525b', // zinc-600
  axisText: '#71717a', // zinc-500
  labelText: '#d4d4d8', // zinc-300
  series: '#65a30d', // lime-600, primary data series
  deemphasis: '#71717a', // zinc-500, secondary/raw data
} as const
