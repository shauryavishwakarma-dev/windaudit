import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, Compass, Calculator } from 'lucide-react';
import { useLanguage } from '../i18n';

interface NotFoundPageProps {
  requestedPath: string;
  onReturnHome: () => void;
  onOpenMethodology: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  requestedPath,
  onReturnHome,
  onOpenMethodology
}) => {
  const { t } = useLanguage();
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center px-4 py-16 sm:px-8 sm:py-24">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-2xl border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/45 dark:bg-[#101216] p-6 sm:p-10"
      >
        <div className="flex items-center gap-2 font-mono-tabular text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC2626] dark:text-[#EF4444]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>404 // ROUTE NOT FOUND</span>
        </div>

        <h1 className="font-display mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-[#111214] dark:text-[#F3F4F6]">
          {t('notfound_title')}
        </h1>

        <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#52565E] dark:text-[#9CA3AF]">
          The requested path{' '}
          <code className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] px-1.5 py-0.5 font-mono-tabular text-xs text-[#0F62FE] dark:text-sky-400 break-all">
            {requestedPath}
          </code>{' '}
          does not exist in the AeroCheck feasibility auditor. Return to the main 3D telemetry stage or inspect the aerodynamic equations.
        </p>

        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onReturnHome}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 bg-[#0F62FE] px-5 py-2.5 font-mono-tabular text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t('notfound_home')}</span>
          </button>

          <button
            type="button"
            onClick={onOpenMethodology}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] px-5 py-2.5 font-mono-tabular text-xs font-bold uppercase tracking-wider text-[#111214] dark:text-[#F3F4F6] transition-colors hover:border-[#0F62FE] dark:hover:border-sky-400 cursor-pointer"
          >
            <Calculator className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
            <span>{t('notfound_method')}</span>
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-[#D4D4CE] dark:border-[#22252A] pt-4 font-mono-tabular text-[11px] text-[#52565E] dark:text-[#8E94A0]">
          <Compass className="h-3.5 w-3.5 shrink-0 text-[#0F62FE] dark:text-sky-400" />
          <span>Valid routes: / · /auditor · /analytics · /methodology</span>
        </div>
      </motion.section>
    </main>
  );
};
