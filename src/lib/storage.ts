import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const PRODUCT_IMAGES_BUCKET = 'product-images'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function validateProductImage(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return 'Use JPEG, PNG, WebP ou GIF.'
  }
  if (file.size > MAX_BYTES) {
    return 'Imagem deve ter no máximo 5MB.'
  }
  return null
}

/** Uploads a product image and returns its public URL. */
export async function uploadProductImage(file: File): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

  const validationError = validateProductImage(file)
  if (validationError) throw new Error(validationError)

  const ext = EXT_BY_TYPE[file.type] ?? 'bin'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })

  if (error) throw error

  const { data } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(path)

  return data.publicUrl
}
