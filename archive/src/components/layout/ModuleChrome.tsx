import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { findNavGroup, findNavItem } from '../../data/navigation';
import { routeForView } from '../../data/routes';

interface ModuleChromeProps {
  activeView: string;
  favorite: boolean;
  onToggleFavorite: () => void;
}

export default function ModuleChrome({ activeView, favorite: controlledFavorite, onToggleFavorite }: ModuleChromeProps) {
  const [localFavorite, setLocalFavorite] = useState(controlledFavorite);

  useEffect(() => {
    const sync = () => {
      try {
        const favorites = JSON.parse(localStorage.getItem('antitode_favorites') || '[]') as string[];
        setLocalFavorite(favorites.includes(activeView));
      } catch {
        setLocalFavorite(false);
      }
    };
    sync();
    window.addEventListener('antitode-favorites-changed', sync);
    return () => window.removeEventListener('antitode-favorites-changed', sync);
  }, [activeView]);

  const favorite = localFavorite;
  const group = findNavGroup(activeView);
  const item = findNavItem(activeView);
  if (!item) return null;

  return (
    <div className="at-module-chrome">
      <div className="at-module-chrome-crumbs">
        <span>{group?.title ?? 'Workspace'}</span>
        <span className="at-module-chrome-separator">/</span>
        <strong>{item.label}</strong>
        <code>{routeForView(activeView)}</code>
      </div>

      <div className="at-module-chrome-right">
        <span className="at-module-status-chip"><span /> Live</span>
        <button
          type="button"
          className={`at-module-favorite ${favorite ? 'is-favorite' : ''}`}
          onClick={onToggleFavorite}
          aria-label={favorite ? `Remove ${item.label} from favorites` : `Favorite ${item.label}`}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={14} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}
