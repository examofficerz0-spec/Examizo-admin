import React from 'react';
import { ExamizoIcon } from './ExamizoIcon';
import { ExamizoButterflyIcon } from './ExamizoButterflyIcon';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  subtitle?: string;
  textSize?: string;
  animate?: boolean;
  variant?: 'butterfly' | 'mascot';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 48,
  showText = true,
  subtitle,
  textSize,
  animate = true,
  variant = 'butterfly',
}) => {
  const scaledSize = Math.round(size * 1.10);

  const calculatedTextSize =
    textSize ||
    (scaledSize >= 50
      ? 'text-2xl'
      : scaledSize >= 40
      ? 'text-xl'
      : 'text-lg');

  return (
    <div className={`flex items-center gap-3.5 group examizo-container select-none ${className}`}>
      <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-105">
        {variant === 'butterfly' ? (
          <ExamizoButterflyIcon size={scaledSize} animate={animate} />
        ) : (
          <ExamizoIcon size={scaledSize} animate={animate} />
        )}
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className={`font-black tracking-tight leading-none text-slate-900 dark:text-white font-sans transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 ${calculatedTextSize}`}>
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
