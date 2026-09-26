import { ReactNode } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  id?: string;
}

interface PageHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  description?: string;
  timeRange?: string;
  actions?: ReactNode;
  filters?: ReactNode;
}

export default function PageHeader({
  breadcrumbs,
  title,
  description,
  timeRange,
  actions,
  filters,
}: PageHeaderProps) {
  return (
    <section className="at-page-header">
      <div className="at-page-header-inner">
        <div className="at-breadcrumb-row">
          {timeRange && (
            <button type="button" className="at-range-control" style={{ marginLeft: "auto" }}>
              <Calendar size={13} />
              <span>{timeRange}</span>
              <ChevronRight size={12} />
            </button>
          )}
        </div>

        <div className="at-page-title-row">
          <div className="at-page-heading">
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>

          {actions && <div className="at-page-actions">{actions}</div>}
        </div>

        {filters && <div className="at-page-filters">{filters}</div>}
      </div>
    </section>
  );
}
