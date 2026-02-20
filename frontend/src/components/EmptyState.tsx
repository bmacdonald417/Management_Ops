import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  description: string;
  primaryAction?: { label: string; to: string };
  secondaryAction?: { label: string; to: string };
  icon?: ReactNode;
}

export default function EmptyState({ title, description, primaryAction, secondaryAction, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="mb-4 text-slate-400">{icon}</div>}
      <h3 className="font-display font-semibold text-lg text-gov-navy mb-2">{title}</h3>
      <p className="text-slate-600 max-w-md mb-6">{description}</p>
      <div className="flex gap-3 flex-wrap justify-center">
        {primaryAction && (
          <Link to={primaryAction.to} className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium hover:opacity-90">
            {primaryAction.label}
          </Link>
        )}
        {secondaryAction && (
          <Link to={secondaryAction.to} className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-300">
            {secondaryAction.label}
          </Link>
        )}
      </div>
    </div>
  );
}
