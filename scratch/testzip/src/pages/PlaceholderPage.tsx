import { type LucideIcon, Construction, ArrowUpRight } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

export default function PlaceholderPage({
  title,
  description,
  icon: Icon = Construction,
  actionLabel = 'Open workspace',
  onAction,
}: PlaceholderProps) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-6 sm:p-8 bg-at-bg">
      <div className="w-full max-w-xl">
        <div className="rounded-2xl border border-at-border bg-at-surface/70 shadow-[0_12px_40px_rgba(0,0,0,0.16)] overflow-hidden">
          <div className="h-1 bg-at-accent/80" />

          <div className="p-7 sm:p-9">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl border border-at-border bg-at-bg flex items-center justify-center text-at-accent shrink-0">
                <Icon size={21} strokeWidth={1.7} />
              </div>

              <div className="min-w-0">
                <div className="at-eyebrow mb-2">ANTITODE WORKSPACE</div>

                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-at-text">
                  {title}
                </h2>

                <p className="mt-2 text-[13px] leading-6 text-at-muted max-w-lg">
                  {description}
                </p>
              </div>
            </div>

            <div className="mt-7 pt-5 border-t border-at-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium text-at-text-secondary">
                    Workspace status
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-at-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-at-disabled" />
                    Module not connected to an active data workflow
                  </div>
                </div>

                {onAction && (
                  <button
                    type="button"
                    onClick={onAction}
                    className="at-btn at-btn-secondary at-btn-sm justify-center"
                  >
                    {actionLabel}
                    <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}