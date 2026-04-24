import React, { useEffect, useState } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const ThemeToggle = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.setAttribute('data-theme', systemTheme);
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = window.document.documentElement;
      root.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-1 p-1.5 glass rounded-2xl shadow-2xl border-white/5">
      <button 
        onClick={() => setTheme('light')} 
        title="Light Mode"
        className={cn("p-2.5 rounded-xl transition-all", theme === 'light' ? "primary-gradient text-foreground shadow-lg" : "text-secondary hover:bg-foreground/5")}
      >
        <Sun className="w-4 h-4" />
      </button>
      <button 
        onClick={() => setTheme('dark')} 
        title="Dark Mode"
        className={cn("p-2.5 rounded-xl transition-all", theme === 'dark' ? "primary-gradient text-foreground shadow-lg" : "text-secondary hover:bg-foreground/5")}
      >
        <Moon className="w-4 h-4" />
      </button>
      <button 
        onClick={() => setTheme('system')} 
        title="System Preference"
        className={cn("p-2.5 rounded-xl transition-all", theme === 'system' ? "primary-gradient text-foreground shadow-lg" : "text-secondary hover:bg-foreground/5")}
      >
        <Laptop className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ThemeToggle;
