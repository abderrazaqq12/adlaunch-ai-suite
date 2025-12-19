import { cn } from '@/lib/utils';
import type { Platform } from '@/types';

interface PlatformBadgeProps {
  platform: Platform;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const platformConfig: Record<Platform, { label: string; className: string }> = {
  google: {
    label: 'Google Ads',
    className: 'bg-google text-white',
  },
  tiktok: {
    label: 'TikTok Ads',
    className: 'bg-gradient-to-r from-tiktok to-tiktok-pink text-white',
  },
  snapchat: {
    label: 'Snapchat Ads',
    className: 'bg-snapchat text-black',
  },
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function PlatformBadge({ platform, size = 'md', className }: PlatformBadgeProps) {
  const config = platformConfig[platform];
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        sizeStyles[size],
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
