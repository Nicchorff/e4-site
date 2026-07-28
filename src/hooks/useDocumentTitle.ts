import { useEffect } from 'react'

const DEFAULT_TITLE = 'Elite Four (E4)'

/** Sets document.title while mounted; restores default on unmount. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title.includes('Elite Four')
      ? title
      : `${title} · Elite Four`
    return () => {
      document.title = prev || DEFAULT_TITLE
    }
  }, [title])
}

/** Absolute OG/Twitter URLs when VITE_SITE_URL is set. */
export function applyAbsoluteSeoUrls() {
  const base = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  )
  if (!base || typeof document === 'undefined') return

  const abs = (path: string) =>
    path.startsWith('http')
      ? path
      : `${base}${path.startsWith('/') ? path : `/${path}`}`

  const ensureMeta = (attr: 'property' | 'name', key: string, content: string) => {
    const selector =
      attr === 'property'
        ? `meta[property="${key}"]`
        : `meta[name="${key}"]`
    let el = document.querySelector(selector)
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute(attr, key)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  ensureMeta('property', 'og:url', `${base}/`)
  ensureMeta('property', 'og:image', abs('/e4-logo.png'))
  ensureMeta('name', 'twitter:image', abs('/e4-logo.png'))
}
