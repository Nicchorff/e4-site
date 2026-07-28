import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

type RulesMarkdownProps = {
  content: string
  className?: string
}

export function RulesMarkdown({ content, className }: RulesMarkdownProps) {
  return (
    <div
      className={cn(
        'prose-e4 space-y-3 text-sm leading-relaxed text-e4-white sm:text-base',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="font-display text-xl font-bold text-e4-gold sm:text-2xl">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="mt-4 font-display text-lg font-semibold text-e4-gold">
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="mt-3 font-display text-base font-semibold text-e4-silver">
              {children}
            </h5>
          ),
          p: ({ children }) => <p className="text-e4-white/95">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1.5 pl-5 text-e4-white/95">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 pl-5 text-e4-white/95">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-e4-gold underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-e4-gold">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="rounded bg-e4-black px-1.5 py-0.5 font-mono text-xs text-e4-dusk">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-e4-gold-deep pl-3 text-e4-silver">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
