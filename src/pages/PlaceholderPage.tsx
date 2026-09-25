import { type LucideIcon, Construction, ArrowUpRight } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export default function PlaceholderPage({
  title,
  description,
  icon: Icon = Construction,
}: PlaceholderProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-at-accent/8 border border-at-accent/15 flex items-center justify-center text-at-accent mb-6">
          <Icon size={28} strokeWidth={1.5} />
        </div>
        <span className="at-eyebrow mb-2 inline-block">ANTITODE WORKSPACE</span>
        <h2 className="text-2xl font-bold text-at-text mb-2 tracking-tight">{title}</h2>
        <p className="text-[14px] text-at-muted leading-relaxed mb-6">{description}</p>
        <div className="flex items-center justify-center gap-3">
          <span className="at-badge at-badge-neutral">Coming Soon</span>
          <button type="button" className="at-btn at-btn-secondary at-btn-sm">
            Learn more <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
