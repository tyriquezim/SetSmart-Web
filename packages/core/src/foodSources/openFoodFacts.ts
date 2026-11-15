import { KJ_PER_KCAL } from '../units'
import type { FoodData } from '../types'

// Open Food Facts: free, open database of packaged products (no API key).
// https://openfoodfacts.github.io/openfoodfacts-server/api/

const BASE = 'https://world.openfoodfacts.org'
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'nutriments',
].join(',')

type Num = number | string | undefined

export interface OffProduct {
  code?: string
  product_name?: string
  product_name_en?: string
  generic_name?: string
  brands?: string
  quantity?: string
  product_quantity_unit?: string
  serving_size?: string
  serving_quantity?: Num
  serving_quantity_unit?: string
  nutriments?: Record<string, Num>
}

const num = (v: Num): number | null => {
  if (v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const clean = (s: string | undefined) => s?.replace(/\s+/g, ' ').trim() || null

/** "33 g (2 biscuits)" → "2 biscuits"; a bare "33 g" gives null (the size already says it). */
function servingLabel(servingSize: string | undefined): string | null {
  const s = clean(servingSize)
  if (!s) return null
  const inner = s.match(/\(([^)]+)\)/)?.[1]?.trim()
  if (inner && !/^\d+([.,]\d+)?\s*(g|ml)$/i.test(inner)) return inner
  return /^\d+([.,]\d+)?\s*(g|ml)$/i.test(s) ? null : s
}

/**
 * Convert an Open Food Facts product to FoodData. Returns null when the product
 * has no usable name or no energy value, since it can't be logged meaningfully.
 */
export function parseOffProduct(p: OffProduct): FoodData | null {
  const name = clean(p.product_name) ?? clean(p.product_name_en) ?? clean(p.generic_name)
  const code = clean(p.code)
  if (!name || !code) return null
  const n = p.nutriments ?? {}
  const kj = num(n['energy-kj_100g'])
  const kcal = num(n['energy-kcal_100g'])
  const energy = num(n['energy_100g']) // OFF normalises the generic energy field to kJ
  const energyKj = kj ?? (kcal != null ? kcal * KJ_PER_KCAL : energy)
  if (energyKj == null) return null

  const isLiquid = /^(ml|cl|l)$/i.test(p.product_quantity_unit ?? '') || /\d\s*(ml|cl|l)\b/i.test(p.quantity ?? '')
  const servingSize = num(p.serving_quantity)
  return {
    source: 'off',
    sourceId: code,
    name,
    brand: clean(p.brands?.split(',')[0]),
    barcode: code,
    baseUnit: isLiquid ? 'ml' : 'g',
    per100: {
      energyKj: Math.round(energyKj * 10) / 10,
      proteinG: num(n['proteins_100g']),
      carbsG: num(n['carbohydrates_100g']),
      fatG: num(n['fat_100g']),
    },
    servingSize: servingSize && servingSize > 0 ? servingSize : null,
    servingLabel: servingLabel(p.serving_size),
  }
}

/** Full-text product search. Results without a name or energy value are dropped. */
export async function searchOpenFoodFacts(
  query: string,
  opts: { signal?: AbortSignal; pageSize?: number } = {},
): Promise<FoodData[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(opts.pageSize ?? 24),
    fields: FIELDS,
  })
  const res = await fetch(`${BASE}/cgi/search.pl?${params}`, { signal: opts.signal })
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`)
  const body = (await res.json()) as { products?: OffProduct[] }
  return (body.products ?? []).map(parseOffProduct).filter((f): f is FoodData => f !== null)
}

/** Look up one product by barcode. Resolves to null if it isn't in the database. */
export async function lookupBarcode(barcode: string, opts: { signal?: AbortSignal } = {}): Promise<FoodData | null> {
  const code = barcode.replace(/\D/g, '')
  if (!code) return null
  const res = await fetch(`${BASE}/api/v2/product/${code}?fields=${FIELDS}`, { signal: opts.signal })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Open Food Facts lookup failed (${res.status})`)
  const body = (await res.json()) as { status?: number; product?: OffProduct }
  if (body.status !== 1 || !body.product) return null
  return parseOffProduct({ ...body.product, code: body.product.code ?? code })
}
