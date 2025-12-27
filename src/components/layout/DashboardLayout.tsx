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

export function DashboardLayout() {
  const { user } = useProjectStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050810]">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className={cn(
        "relative transition-all duration-300",
        sidebarCollapsed ? "pl-16" : "pl-56"
      )}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-white/5 bg-[#050810]/80 backdrop-blur-xl">
          <div className="flex h-full items-center justify-between px-6">
            {/* Left: Search */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search campaigns, assets..."
                  className="h-9 w-72 rounded-lg bg-white/5 border border-white/10 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">/</kbd>
              </div>
            </div>

            {/* Right: Date, Notifications, User */}
            <div className="flex items-center gap-4">
              {/* Date */}
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <button className="bg-red-500 text-white p-2 rounded">
                    DEBUG DATE
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 bg-white text-black" align="end">
                  <div>
                    Popover Content Here
                    <br />
                    Date: {date?.toISOString()}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Notifications */}
              <button className="relative h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
              </button>

              {/* User Avatar */}
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-600 text-sm font-medium text-white">
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
        <div className="min-h-[calc(100vh-4rem)] p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
