import ThemeSwitcher from './ThemeSwitcher';

/** A fixed-position theme control for the logged-out auth pages, which
 * have no sidebar to host the switcher in. */
export default function ThemeToggleFloating() {
  return (
    <div className="theme-toggle-floating">
      <ThemeSwitcher variant="compact" />
    </div>
  );
}
