import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor, Search } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

export type CommandMenuItemDef = {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  href?: string
  action?: () => void
  keywords?: string[]
}

export type CommandMenuGroupDef = {
  heading: string
  items: CommandMenuItemDef[]
}

export interface CommandMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
  shortcut?: string
  showShortcut?: boolean
}

export interface CommandMenuProps {
  groups?: CommandMenuGroupDef[]
  showThemeGroup?: boolean
  placeholder?: string
  shortcutKey?: string
  trigger?: React.ReactNode
  triggerProps?: CommandMenuTriggerProps
  className?: string
}

function CommandMenuTrigger({
  label = 'Search…',
  shortcut = 'K',
  showShortcut = true,
  className,
  onClick,
  ...props
}: CommandMenuTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full max-w-sm cursor-pointer items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm text-muted-foreground backdrop-blur-sm transition-colors hover:bg-accent/50',
        className,
      )}
      {...props}
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {showShortcut && (
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>{shortcut}</Kbd>
        </KbdGroup>
      )}
    </button>
  )
}

function CommandMenu({
  groups = [],
  showThemeGroup = true,
  placeholder = 'Search components, pages, actions…',
  shortcutKey = 'k',
  trigger,
  triggerProps,
  className,
}: CommandMenuProps) {
  const navigate = useNavigate()
  const { setTheme } = useTheme()

  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === shortcutKey.toLowerCase() &&
        (e.metaKey || e.ctrlKey)
      ) {
        e.preventDefault()
        e.stopPropagation()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down, { capture: true })
    return () =>
      document.removeEventListener('keydown', down, { capture: true })
  }, [shortcutKey])

  const run = React.useCallback((fn: () => void) => {
    setOpen(false)
    fn()
  }, [])

  const handleItemSelect = React.useCallback(
    (item: CommandMenuItemDef) => {
      if (item.action) {
        run(item.action)
      } else if (item.href) {
        run(() => navigate(item.href!))
      }
    },
    [run, navigate],
  )

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="cursor-pointer">
          {trigger}
        </span>
      ) : (
        <CommandMenuTrigger
          shortcut={shortcutKey.toUpperCase()}
          {...triggerProps}
          onClick={() => setOpen(true)}
        />
      )}

      <CommandDialog open={open} onOpenChange={setOpen} className={className}>
        <CommandInput placeholder={placeholder} />
        <CommandList data-lenis-prevent="command-menu">
          <CommandEmpty>
            <span className="font-mono text-sm text-muted-foreground">
              No results found.
            </span>
          </CommandEmpty>

          {groups.map((group, gi) => (
            <React.Fragment key={`g-${gi}`}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={group.heading}>
                {group.items.map((item, ii) => (
                  <CommandItem
                    key={`i-${gi}-${ii}`}
                    keywords={item.keywords}
                    onSelect={() => handleItemSelect(item)}
                  >
                    {item.icon && (
                      <item.icon className="mr-2 size-4 shrink-0" />
                    )}
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}

          {showThemeGroup && (
            <>
              {groups.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Theme">
                <CommandItem
                  keywords={['light', 'bright', 'white', 'day']}
                  onSelect={() => run(() => setTheme('light'))}
                >
                  <Sun className="mr-2 size-4" />
                  Light Mode
                </CommandItem>
                <CommandItem
                  keywords={['dark', 'night', 'black']}
                  onSelect={() => run(() => setTheme('dark'))}
                >
                  <Moon className="mr-2 size-4" />
                  Dark Mode
                </CommandItem>
                <CommandItem
                  keywords={['system', 'auto', 'os', 'default']}
                  onSelect={() => run(() => setTheme('system'))}
                >
                  <Monitor className="mr-2 size-4" />
                  System Theme
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

export { CommandMenu, CommandMenuTrigger }
