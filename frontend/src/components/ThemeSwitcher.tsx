import { useId } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Snowflake, type LucideIcon } from 'lucide-react';
import { useTheme, type Theme } from '../context/ThemeContext';

const ICONS: Record<Theme, LucideIcon> = {
  light: Sun,
  dark: Moon,
  ice: Snowflake,
};

const LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  ice: 'Ice',
};

const ORDER: Theme[] = ['light', 'dark', 'ice'];

/**
 * A segmented theme control. The active option's highlight is a single
 * shared-layout element that framer-motion glides between positions,
 * rather than three independently-faded backgrounds — that's what makes
 * switching themes feel like one continuous motion instead of a flicker.
 *
 * The switcher can be mounted in more than one place at once (the sidebar's
 * compact version and the Settings page's full version, say) — each needs
 * its own `layoutId` namespace via useId(), or framer-motion would try to
 * animate the highlight *between* those unrelated instances instead of
 * within each one.
 */
export default function ThemeSwitcher({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { theme, setTheme } = useTheme();
  const instanceId = useId();

  return (
    <div className="theme-switcher" role="radiogroup" aria-label="Theme">
      {ORDER.map((t) => {
        const Icon = ICONS[t];
        const active = theme === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LABELS[t]}
            className={`theme-switcher-option ${active ? 'active' : ''}`}
            onClick={() => setTheme(t)}
          >
            {active && (
              <motion.span
                layoutId={`theme-switcher-pill-${instanceId}`}
                className="theme-switcher-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <Icon size={variant === 'compact' ? 15 : 14} />
            {variant === 'full' && <span>{LABELS[t]}</span>}
          </button>
        );
      })}
    </div>
  );
}
