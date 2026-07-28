import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AdminCommandMenu } from '@/components/admin/AdminCommandMenu'
import { Analytics } from '@/components/Analytics'
import { useAuth } from '@/hooks/useAuth'

export function RootLayout() {
  const { isAdmin } = useAuth()

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-e4-gold focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:font-bold focus:text-e4-black"
      >
        Ir ao conteúdo
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {isAdmin && <AdminCommandMenu />}
      <Analytics />
    </div>
  )
}
