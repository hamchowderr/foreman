"use client";

interface ReauthBannerProps {
  onDismiss?: () => void;
}

export function ReauthBanner({ onDismiss }: ReauthBannerProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-sm">
      <span className="text-amber-600 dark:text-amber-400 font-medium">
        &#9888;
      </span>
      <p className="flex-1 text-amber-800 dark:text-amber-200">
        Your Zapier connection needs to be re-authenticated. Please reconnect
        your account to continue using actions.
      </p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 text-xs font-medium"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
