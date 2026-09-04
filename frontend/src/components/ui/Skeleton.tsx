import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 ${className}`} />
);

export const DashboardSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto pb-12 space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6"
        >
          <Skeleton className="h-4 w-1/3 mb-3" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      ))}
    </div>
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
      <Skeleton className="h-4 w-1/4 mb-5" />
      <Skeleton className="h-36 sm:h-44 w-full" />
    </div>
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
      <Skeleton className="h-4 w-1/4" />
      {[0, 1, 2].map(i => (
        <div key={i} className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-6 w-1/4" />
        </div>
      ))}
    </div>
  </div>
);

export const LayoutSkeleton: React.FC = () => (
  <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased">
    <div className="hidden lg:flex w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 gap-3">
      <Skeleton className="h-10 w-3/4 mb-2" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
      <Skeleton className="h-4 w-1/2 mt-4" />
    </div>
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-full sm:hidden" />
        <Skeleton className="h-8 w-40 rounded-full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <DashboardSkeleton />
      </main>
    </div>
  </div>
);