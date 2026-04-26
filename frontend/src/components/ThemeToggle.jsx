import React, { useEffect, useState, useCallback } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const ThemeToggle = ({ isInline = false }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');

  const applyTheme = useCallback((targetTheme) => {
    const root = window.document.documentElement;
    let actualTheme = targetTheme;
    
    if (targetTheme === 'system') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    root.setAttribute('data-theme', actualTheme);
    // Force a color-scheme update for the browser
    root.style.colorScheme = actualTheme;
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    
    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  return (
    <div className={cn(
      "theme-toggle flex gap-1 glass border-foreground/5 transition-all",
      isInline 
        ? "relative flex-row p-1 rounded-xl" 
        : "fixed top-3 left-12 sm:top-auto sm:left-auto sm:bottom-6 sm:right-6 z-50 flex-row sm:flex-col p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-2xl"
    )}>
      <button 
        onClick={() => setTheme('light')} 
        title="Light Mode"
        className={cn("p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all", theme === 'light' ? "primary-gradient text-white shadow-lg" : "text-secondary hover:bg-foreground/5")}
      >
        <Sun className="w-4 h-4" />
      </button>
      <button 
        onClick={() => setTheme('dark')} 
        title="Dark Mode"
        className={cn("p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all", theme === 'dark' ? "primary-gradient text-white shadow-lg" : "text-secondary hover:bg-foreground/5")}
      >
        <Moon className="w-4 h-4" />
      </button>
      <button 
        onClick={() => setTheme('system')} 
        title="System Preference"
        className={cn("p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all", theme === 'system' ? "primary-gradient text-white shadow-lg" : "text-secondary hover:bg-foreground/5")}
      >
        <Laptop className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ThemeToggle;
