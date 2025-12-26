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

export function Sidebar() {
  const location = useLocation();
  const { user, setUser, setIsApproved } = useProjectStore();

  const handleLogout = () => {
    setUser(null);
    setIsApproved(false);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-16 border-r border-white/5 bg-[#0a0f1e]/90 backdrop-blur-xl">
      <div className="flex h-full flex-col items-center py-4">
        {/* Logo */}
        <div className="mb-6">
          <img src="/logo.png" alt="AdLaunch AI" className="h-10 w-10 rounded-xl" />
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1a1f2e] border-white/10">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom nav items */}
        <div className="space-y-2 pt-4 border-t border-white/5">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1a1f2e] border-white/10">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Logout */}
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
        </div>
      </div>
    </aside>
  );
}
