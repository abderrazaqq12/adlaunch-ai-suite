import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Search, Bell, Calendar as CalendarIcon } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/lib/utils';
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";

export function DashboardLayout() {
  const { user } = useProjectStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background gradient effects - only in dark mode */}
      {isDark && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
          <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        </div>
      )}

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className={cn(
        "relative transition-all duration-300",
        sidebarCollapsed ? "pl-16" : "pl-56"
      )}>
        {/* Top Header */}
        <header className={cn(
          "sticky top-0 z-30 h-16 border-b",
          isDark
            ? "border-border bg-background/80 backdrop-blur-xl"
            : "border-border bg-white shadow-sm"
        )}>
          <div className="flex h-full items-center justify-between px-6">
            {/* Left: Search */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Search campaigns, assets..."
                  className={cn(
                    "h-9 w-72 rounded-lg pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all",
                    isDark
                      ? "bg-card/50 border border-white/5 hover:bg-card/80"
                      : "bg-slate-50 border border-border hover:bg-slate-100"
                  )}
                />
                <kbd className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground px-1.5 py-0.5 rounded border",
                  isDark ? "bg-white/5 border-white/5" : "bg-slate-100 border-border"
                )}>/</kbd>
              </div>
            </div>

            {/* Right: Theme Toggle, Date, Notifications, User */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Date */}
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[200px] justify-start text-left font-normal transition-all",
                      isDark
                        ? "bg-card/50 border-white/5 hover:bg-card hover:text-white"
                        : "bg-white border-border hover:bg-slate-50",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn(
                    "w-auto p-0",
                    isDark ? "border-white/10 bg-card/95 backdrop-blur-xl" : "border-border bg-white"
                  )}
                  align="end"
                >
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => {
                      setDate(newDate);
                      setIsCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Notifications */}
              <button className={cn(
                "relative h-9 w-9 rounded-lg flex items-center justify-center transition-all group",
                isDark
                  ? "bg-card/50 border border-white/5 hover:bg-card hover:border-white/10"
                  : "bg-slate-50 border border-border hover:bg-slate-100"
              )}>
                <Bell className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="absolute top-2 right-2 h-1.5 w-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              </button>

              {/* User Avatar */}
              <div className={cn(
                "flex items-center gap-3 pl-3 border-l",
                isDark ? "border-white/5" : "border-border"
              )}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-600 text-sm font-medium text-white shadow-lg shadow-primary/20 ring-2 ring-primary/20">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="min-h-[calc(100vh-4rem)] p-6 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
