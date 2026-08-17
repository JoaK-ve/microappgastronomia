export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'ud'

export type UserRole = 'admin' | 'kitchen'

export type Business = {
  id: string
  name: string
  commercial_name: string | null
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  tax_id: string | null
  currency: string
  language: string
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  business_id: string
  name: string
  email: string
  role: UserRole
  status: string
  created_at: string
}

export type Ingredient = {
  id: string
  business_id: string
  name: string
  category: string | null
  usage_unit: Unit
  created_at: string
  updated_at: string
}

export type IngredientEquivalence = {
  id: string
  ingredient_id: string
  from_quantity: number
  from_unit: Unit
  to_quantity: number
  to_unit: Unit
}

export type PurchaseFormat = {
  id: string
  ingredient_id: string
  description: string
  quantity: number
  unit: Unit
  price: number
  price_date: string
}

export type IngredientCost = {
  ingredient_id: string
  source_purchase_format_id: string | null
  source_unit: Unit | null
  unit_cost: number | null
  missing_reason: string | null
}

export type Recipe = {
  id: string
  business_id: string
  name: string
  category: string | null
  code: string | null
  status: string
  version: number
  steps: string[]
  yield_quantity: number | null
  yield_unit: Unit | null
  conservation_method: string | null
  conservation_temperature: string | null
  conservation_shelf_life: string | null
  conservation_notes: string | null
  created_at: string
  updated_at: string
}

export type RecipeComponentType = 'ingredient' | 'recipe'

export type RecipeComponent = {
  id: string
  recipe_id: string
  component_type: RecipeComponentType
  ingredient_id: string | null
  component_recipe_id: string | null
  quantity: number
  unit: Unit
  position: number
}

export type RecipeCost = {
  recipe_id: string
  business_id: string
  total_cost: number | null
  unit_cost: number | null
  is_complete: boolean
  yield_available: boolean
  missing_reasons: string[]
}
