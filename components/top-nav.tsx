"use client"

import { useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import {
  Check,
  Eraser,
  FileText,
  History,
  Menu,
  Monitor,
  Moon,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react"
import { ContactDialog } from "@/components/contact-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const themeOptions = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
]

interface TopNavProps {
  onClearWorkspace?: () => void
}

export function TopNav({ onClearWorkspace }: TopNavProps) {
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex size-9 items-center justify-center rounded-xl gradient-purple shadow-soft">
            <Sparkles className="size-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Offer<span className="text-gradient-purple">Match</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
          <Link
            href="/templates"
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <FileText className="size-4" aria-hidden="true" />
            简历模板
          </Link>

          <Link
            href="/history"
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <History className="size-4" aria-hidden="true" />
            历史记录
          </Link>

          {onClearWorkspace && (
            <button
              type="button"
              onClick={onClearWorkspace}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Eraser className="size-4" aria-hidden="true" />
              清空工作台
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none">
              <Settings className="size-4" aria-hidden="true" />
              设置
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>页面明暗</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {themeOptions.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => setTheme(value)}
                    className="cursor-pointer gap-2"
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    {theme === value && <Check className="size-4 text-primary" aria-hidden="true" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-2">
          <ContactDialog />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full md:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/60 bg-background/95 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="移动端导航">
            <Link
              href="/templates"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              <FileText className="size-4" aria-hidden="true" />
              简历模板
            </Link>
            <Link
              href="/history"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              <History className="size-4" aria-hidden="true" />
              历史记录
            </Link>
            {onClearWorkspace && (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  onClearWorkspace()
                }}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-secondary"
              >
                <Eraser className="size-4" aria-hidden="true" />
                清空工作台
              </button>
            )}
            <div className="mt-2 flex flex-wrap gap-2 px-1">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                  {theme === value && <Check className="size-3.5 text-primary" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
