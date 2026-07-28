import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { CartProvider } from '@/hooks/useCart'
import { AuthProvider } from '@/hooks/useAuth'
import { RootLayout } from '@/components/layout/RootLayout'
import { RequireAdmin } from '@/components/auth/RequireAuth'
import { HomePage } from '@/pages/HomePage'
import { RegrasPage } from '@/pages/RegrasPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'

const LojaPage = lazy(() =>
  import('@/pages/LojaPage').then((m) => ({ default: m.LojaPage })),
)
const LojaCategoriaPage = lazy(() =>
  import('@/pages/LojaCategoriaPage').then((m) => ({
    default: m.LojaCategoriaPage,
  })),
)
const CarrinhoPage = lazy(() =>
  import('@/pages/CarrinhoPage').then((m) => ({ default: m.CarrinhoPage })),
)
const PerfilPage = lazy(() =>
  import('@/pages/PerfilPage').then((m) => ({ default: m.PerfilPage })),
)
const AdminPage = lazy(() =>
  import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })),
)
const AdminRegrasPage = lazy(() =>
  import('@/pages/AdminRegrasPage').then((m) => ({
    default: m.AdminRegrasPage,
  })),
)
const AdminLojaPage = lazy(() =>
  import('@/pages/AdminLojaPage').then((m) => ({ default: m.AdminLojaPage })),
)
const AdminConteudoPage = lazy(() =>
  import('@/pages/AdminConteudoPage').then((m) => ({
    default: m.AdminConteudoPage,
  })),
)
const AdminDepoimentosPage = lazy(() =>
  import('@/pages/AdminDepoimentosPage').then((m) => ({
    default: m.AdminDepoimentosPage,
  })),
)
const AdminUsuariosPage = lazy(() =>
  import('@/pages/AdminUsuariosPage').then((m) => ({
    default: m.AdminUsuariosPage,
  })),
)

function RouteFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-center text-e4-silver">
      Carregando…
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route element={<RootLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="regras" element={<RegrasPage />} />
                  <Route path="loja" element={<LojaPage />} />
                  <Route
                    path="loja/categoria/:slug"
                    element={<LojaCategoriaPage />}
                  />
                  <Route path="loja/carrinho" element={<CarrinhoPage />} />
                  <Route path="perfil" element={<PerfilPage />} />
                  <Route
                    path="auth/discord/callback"
                    element={<AuthCallbackPage />}
                  />
                  <Route
                    path="admin"
                    element={
                      <RequireAdmin>
                        <AdminPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="admin/conteudo"
                    element={
                      <RequireAdmin>
                        <AdminConteudoPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="admin/regras"
                    element={
                      <RequireAdmin>
                        <AdminRegrasPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="admin/loja"
                    element={
                      <RequireAdmin>
                        <AdminLojaPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="admin/depoimentos"
                    element={
                      <RequireAdmin>
                        <AdminDepoimentosPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="admin/usuarios"
                    element={
                      <RequireAdmin>
                        <AdminUsuariosPage />
                      </RequireAdmin>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
