'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor
} as const;

const LABELS = {
  light: 'Switch to dark mode',
  dark: 'Switch to system mode',
  system: 'Switch to light mode'
} as const;

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const Icon = ICONS[theme];

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 cursor-pointer"
      onClick={toggleTheme}
      aria-label={LABELS[theme]}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
