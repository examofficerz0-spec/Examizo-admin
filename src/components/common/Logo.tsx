import React from 'react';
import { ExamizoIcon } from './ExamizoIcon';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  subtitle?: string;
  animate?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 38,
  showText = true,
  subtitle,
  animate = true,
}) => {
  return (
    <div className={`flex items-center gap-2.5 group examizo-container select-none ${className}`}>
      <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-105">
        <ExamizoIcon size={size} animate={animate} />
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white font-sans transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              Examizo
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Admin
            </span>
          </div>
          {subtitle && (
            <span className="text-[10px] text-slate-500 font-medium -mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
