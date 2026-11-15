import { describe, expect, it } from 'vitest'
import { parseOffProduct } from './openFoodFacts'
import { parseUsdaFood } from './usda'

describe('parseOffProduct', () => {
  // Trimmed from a real response for Weet-Bix
  const weetbix = {
    code: '9300652010794',
    product_name: 'Weet-Bix',
    brands: 'Sanitarium, Weet-Bix',
    quantity: '1.2 kg',
    product_quantity_unit: 'g',
    serving_size: '33 g (2 biscuits)',
    serving_quantity: 33,
    nutriments: { 'energy-kj_100g': 1480, 'energy-kcal_100g': 353.4, proteins_100g: 12.4, carbohydrates_100g: 65.9, fat_100g: 1.3 },
  }

  it('maps the fields we use', () => {
    expect(parseOffProduct(weetbix)).toEqual({
      source: 'off',
      sourceId: '9300652010794',
      name: 'Weet-Bix',
      brand: 'Sanitarium',
      barcode: '9300652010794',
      baseUnit: 'g',
      per100: { energyKj: 1480, proteinG: 12.4, carbsG: 65.9, fatG: 1.3 },
      servingSize: 33,
      servingLabel: '2 biscuits',
    })
  })

  it('falls back to kcal, detects liquids and drops bare serving labels', () => {
    const milk = parseOffProduct({
      code: '1',
      product_name: ' Full  cream milk ',
      quantity: '2 L',
      serving_size: '250 ml',
      serving_quantity: '250',
      nutriments: { 'energy-kcal_100g': 64, proteins_100g: '3.4' },
    })
    expect(milk?.name).toBe('Full cream milk')
    expect(milk?.baseUnit).toBe('ml')
    expect(milk?.per100).toEqual({ energyKj: 267.8, proteinG: 3.4, carbsG: null, fatG: null })
    expect(milk?.servingSize).toBe(250)
    expect(milk?.servingLabel).toBeNull()
  })

  it('rejects products without a name or energy', () => {
    expect(parseOffProduct({ ...weetbix, product_name: '', product_name_en: undefined })).toBeNull()
    expect(parseOffProduct({ ...weetbix, nutriments: { proteins_100g: 10 } })).toBeNull()
  })
})

describe('parseUsdaFood', () => {
  it('prefers the kJ value and reads macros by nutrient id', () => {
    const food = parseUsdaFood({
      fdcId: 173944,
      description: 'Bananas, raw',
      foodNutrients: [
        { nutrientId: 1062, value: 371 },
        { nutrientId: 1008, value: 89 },
        { nutrientId: 1003, value: 1.09 },
        { nutrientId: 1004, value: 0.33 },
        { nutrientId: 1005, value: 22.8 },
      ],
    })
    expect(food).toMatchObject({
      source: 'usda',
      sourceId: '173944',
      name: 'Bananas, raw',
      per100: { energyKj: 371, proteinG: 1.09, carbsG: 22.8, fatG: 0.33 },
    })
  })

  it('converts kcal (or Atwater energy) when there is no kJ value', () => {
    const food = parseUsdaFood({ fdcId: 1, description: 'Rice', foodNutrients: [{ nutrientId: 2047, value: 130 }] })
    expect(food?.per100.energyKj).toBe(543.9)
    expect(parseUsdaFood({ fdcId: 2, description: 'Water', foodNutrients: [] })).toBeNull()
  })
})
