import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={`Switch to ${isDark ? 'light' : 'blue-black'} theme`}
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-all duration-300 active:scale-95 ${
        isDark
          ? 'bg-[#0f172a] hover:bg-[#15203b] border-sky-500/30 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.15)]'
          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
      }`}
      title={`Current: ${isDark ? 'Blue-Black' : 'Light'} theme · Click to switch`}
    >
      {/* Animated Icon Container */}
      <div className="relative w-4 h-4 flex items-center justify-center">
        <Sun
          size={14}
          className={`absolute text-amber-500 transition-all duration-500 ease-out transform ${
            isDark ? 'opacity-0 rotate-90 scale-50 pointer-events-none' : 'opacity-100 rotate-0 scale-100'
          }`}
        />
        <Moon
          size={14}
          className={`absolute text-sky-400 transition-all duration-500 ease-out transform ${
            isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50 pointer-events-none'
          }`}
        />
      </div>

      {/* Label with smooth text crossfade */}
      {!compact && (
        <span className="font-medium tracking-tight flex items-center gap-1">
          <span>{isDark ? 'Blue-Black' : 'Light'}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              isDark ? 'bg-sky-400 shadow-[0_0_6px_#38bdf8]' : 'bg-amber-400'
            }`}
          />
        </span>
      )}
    </button>
  );
};
