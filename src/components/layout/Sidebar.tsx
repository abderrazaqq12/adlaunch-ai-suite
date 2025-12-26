import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderOpen,
  Link2,
  Rocket,
  Activity,
  AlertTriangle,
  Zap,
  Eye,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// UX Flow: Dashboard → Assets → Accounts → Publish → Execution → Monitoring → Recovery → Automation
const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/assets', label: 'Assets', icon: FolderOpen },
  { path: '/connections', label: 'Accounts', icon: Link2 },
  { path: '/launch', label: 'Publish', icon: Rocket },
  { path: '/execution', label: 'Execution', icon: Eye },
  { path: '/monitoring', label: 'Monitoring', icon: Activity },
  { path: '/recovery', label: 'Recovery', icon: AlertTriangle },
  { path: '/rules', label: 'Automation', icon: Zap },
];

const bottomNavItems = [
  { path: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { setUser, setIsApproved } = useProjectStore();

  const handleLogout = () => {
    setUser(null);
    setIsApproved(false);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-white/5 bg-[#0a0f1e]/95 backdrop-blur-xl transition-all duration-300",
        isCollapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex h-full flex-col py-4">
        {/* Header with Logo and Toggle */}
        <div className={cn(
          "flex items-center mb-6",
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AdLaunch AI" className="h-10 w-10 rounded-xl flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-lg font-bold text-foreground whitespace-nowrap">AdLaunch</span>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Toggle button when collapsed */}
        {isCollapsed && (
          <button
            onClick={onToggle}
            className="mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Main Navigation */}
        <nav className={cn("flex-1 space-y-1", isCollapsed ? "px-2" : "px-3")}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            const linkContent = (
              <Link
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-xl transition-all duration-200',
                  isCollapsed ? 'h-10 w-10 justify-center' : 'h-10 px-3',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.path} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#1a1f2e] border-white/10">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.path}>{linkContent}</div>;
          })}
        </nav>

        {/* Bottom nav items */}
        <div className={cn("space-y-1 pt-4 border-t border-white/5", isCollapsed ? "px-2" : "px-3")}>
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            const linkContent = (
              <Link
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-xl transition-all duration-200',
                  isCollapsed ? 'h-10 w-10 justify-center' : 'h-10 px-3',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.path} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#1a1f2e] border-white/10">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.path}>{linkContent}</div>;
          })}

          {/* Logout */}
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#1a1f2e] border-white/10">
                Logout
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex h-10 w-full items-center gap-3 px-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
