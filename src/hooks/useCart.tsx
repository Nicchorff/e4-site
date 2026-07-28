import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CartLine, StoreProduct } from '@/types/store'

const STORAGE_KEY = 'e4-cart-v1'

type CartContextValue = {
  lines: CartLine[]
  itemCount: number
  totalCents: number
  addItem: (product: StoreProduct, qty?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function loadInitial(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartLine[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setLines(loadInitial())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines, hydrated])

  const addItem = useCallback((product: StoreProduct, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: l.quantity + qty }
            : l,
        )
      }
      return [...prev, { product, quantity: qty }]
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.product.id !== productId))
  }, [])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setLines((prev) => prev.filter((l) => l.product.id !== productId))
      return
    }
    setLines((prev) =>
      prev.map((l) =>
        l.product.id === productId ? { ...l, quantity } : l,
      ),
    )
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartContextValue>(() => {
    const itemCount = lines.reduce((s, l) => s + l.quantity, 0)
    const totalCents = lines.reduce(
      (s, l) => s + l.product.price_cents * l.quantity,
      0,
    )
    return {
      lines,
      itemCount,
      totalCents,
      addItem,
      removeItem,
      setQuantity,
      clear,
    }
  }, [lines, addItem, removeItem, setQuantity, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
