import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { createDonationTicket } from '@/lib/store'
import { getDiscordInviteUrl } from '@/lib/home-content'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatBrl } from '@/types/store'

export function CarrinhoPage() {
  useDocumentTitle('Carrinho · Elite Four')
  const { lines, totalCents, setQuantity, removeItem, clear, itemCount } =
    useCart()
  const { user, signInWithDiscord } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketResult, setTicketResult] = useState<{
    channelUrl: string
    orderId: string
  } | null>(null)

  const discordInvite = getDiscordInviteUrl()

  async function handleOpenTicket() {
    if (!user) {
      await signInWithDiscord()
      return
    }
    if (lines.length === 0) return

    setBusy(true)
    setError(null)
    try {
      const result = await createDonationTicket(
        lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
        })),
      )
      clear()
      setTicketResult(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível abrir o ticket no Discord.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (ticketResult) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-display text-3xl text-e4-white">Ticket aberto</h1>
        <p className="mt-4 rounded-md border border-e4-gold/40 bg-e4-gold/10 px-3 py-2 text-sm text-e4-gold">
          Pedido criado. Assim que possível alguém irá te atender no Discord.
          Envie o comprovante no canal do ticket.
        </p>
        <p className="mt-3 font-mono text-xs text-e4-silver">
          Pedido: {ticketResult.orderId}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="bg-e4-gold font-display font-bold uppercase text-e4-black hover:bg-e4-gold-deep hover:text-white"
          >
            <a href={ticketResult.channelUrl} target="_blank" rel="noreferrer">
              Abrir canal do ticket
            </a>
          </Button>
          <Button asChild variant="outline" className="border-e4-gold-deep/50">
            <a href={discordInvite} target="_blank" rel="noreferrer">
              Entrar no Discord E4
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/loja">Voltar à loja</Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-3xl text-e4-white">Carrinho</h1>
      <p className="mt-2 text-sm text-e4-silver">
        Pagamento via ticket Discord (temporário). Após abrir o ticket, envie o
        comprovante no canal.
      </p>

      {itemCount === 0 ? (
        <div className="mt-8 space-y-4">
          <p className="text-e4-silver">Seu carrinho está vazio.</p>
          <Button asChild className="bg-e4-gold text-e4-black hover:bg-e4-gold-deep hover:text-white">
            <Link to="/loja">Ir à loja</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {lines.map((line) => (
            <div
              key={line.product.id}
              className="flex flex-col gap-3 rounded-lg border border-e4-gold-deep/35 bg-e4-black-soft p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-display text-lg text-e4-white">
                  {line.product.name}
                </p>
                <p className="font-mono text-sm text-e4-gold">
                  {formatBrl(line.product.price_cents)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) =>
                    setQuantity(line.product.id, Number(e.target.value))
                  }
                  className="h-9 w-16 rounded-md border border-e4-gold-deep/40 bg-e4-black px-2 font-mono text-sm text-e4-white"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(line.product.id)}
                >
                  Remover
                </Button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-e4-gold-deep/30 pt-4">
            <p className="font-display text-sm uppercase text-e4-silver">
              Total
            </p>
            <p className="font-mono text-2xl text-e4-gold">
              {formatBrl(totalCents)}
            </p>
          </div>

          {error && (
            <p className="text-sm text-e4-dusk">{error}</p>
          )}

          {!user && (
            <p className="text-sm text-e4-silver">
              Faça login com Discord para abrir o ticket.
            </p>
          )}

          <Button
            size="lg"
            disabled={busy}
            className="w-full bg-e4-gold font-display font-bold uppercase text-e4-black hover:bg-e4-gold-deep hover:text-white sm:w-auto"
            onClick={() => void handleOpenTicket()}
          >
            {busy
              ? 'Abrindo ticket…'
              : user
                ? 'Abrir ticket'
                : 'Entrar e abrir ticket'}
          </Button>
        </div>
      )}
    </section>
  )
}
