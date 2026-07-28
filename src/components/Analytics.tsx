import { useEffect } from 'react'

/**
 * Plausible analytics — only loads when VITE_PLAUSIBLE_DOMAIN is set.
 */
export function Analytics() {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined

  useEffect(() => {
    if (!domain?.trim()) return
    if (document.querySelector('script[data-e4-plausible]')) return

    const script = document.createElement('script')
    script.defer = true
    script.src = 'https://plausible.io/js/script.js'
    script.setAttribute('data-domain', domain.trim())
    script.setAttribute('data-e4-plausible', '1')
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [domain])

  return null
}
