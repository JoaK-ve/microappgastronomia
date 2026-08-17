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
