"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import {
  Check,
  FileText,
  History,
  Monitor,
  Moon,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react"
import { ContactDialog } from "@/components/contact-dialog"
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

export function TopNav() {
  const { theme, setTheme } = useTheme()

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
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none">
              <FileText className="size-4" aria-hidden="true" />
              简历模板
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuGroup>
                <DropdownMenuLabel>模板预览</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer p-0">
                  <Link
                    href="/templates"
                    className="block w-full px-1.5 py-1 text-sm text-foreground outline-none"
                  >
                    预览
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href="/history"
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <History className="size-4" aria-hidden="true" />
            历史记录
          </Link>

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

        <ContactDialog />
      </div>
    </header>
  )
}
