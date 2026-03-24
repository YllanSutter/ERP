import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Loader } from 'lucide-react';
import { searchSteamGames, loadSteamGamesList, SteamGame } from '@/lib/plugins/steam/steamUtils';

interface SteamPropertyFieldProps {
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
}

const getSteamDisplayName = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name;
    if (typeof value.label === 'string') return value.label;
    if (value.appid !== undefined && value.appid !== null) return String(value.appid);
  }
  return '';
};

export const SteamPropertyField: React.FC<SteamPropertyFieldProps> = ({
  value = '',
  onChange,
  disabled = false
}) => {
  const [searchInput, setSearchInput] = useState(getSteamDisplayName(value));
  const [suggestions, setSuggestions] = useState<SteamGame[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [games, setGames] = useState<SteamGame[]>([]);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger la liste Steam au montage
  useEffect(() => {
    const loadGames = async () => {
      setIsLoading(true);
      const loadedGames = await loadSteamGamesList();
      setGames(loadedGames);
      setGamesLoaded(true);
      setIsLoading(false);
    };
    loadGames();
  }, []);

  useEffect(() => {
    setSearchInput(getSteamDisplayName(value));
  }, [value]);

  // Mettre à jour les suggestions
  useEffect(() => {
    if (searchInput.trim() && isOpen) {
      const results = searchSteamGames(searchInput, games, 10);
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  }, [searchInput, isOpen, games]);

  // Fermer quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectGame = (game: SteamGame) => {
    setSearchInput(game.name);
    onChange?.({ name: game.name, appid: game.appid });
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchInput(newValue);
    onChange?.(newValue);
    setIsOpen(true);
  };

  const minLen = 20;
  const inputLength = (searchInput && typeof searchInput === 'string')
    ? Math.min(Math.max(searchInput.length, minLen), 60)
    : minLen;

  return (
    <div ref={containerRef} className="relative inline-block max-w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchInput}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
              setSuggestions([]);
            }, 120);
          }}
          placeholder="Rechercher un jeu Steam..."
          autoComplete="off"
          disabled={disabled || isLoading}
          className="py-1 bg-transparent border border-transparent text-neutral-700 dark:text-white placeholder-neutral-600 focus:border-black/10 dark:focus:border-white/10 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ width: `${inputLength}ch`, maxWidth: '100%' }}
        />
        {isLoading && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            <Loader className="w-4 h-4 animate-spin" />
          </div>
        )}
        {!isLoading && suggestions.length > 0 && (
          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 min-w-[22rem] max-w-[32rem] bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded shadow-lg z-50">
          <ul className="max-h-64 overflow-y-auto">
            {suggestions.map((game, index) => (
              <li key={`${game.appid}-${index}`}>
                <button
                  onClick={() => handleSelectGame(game)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition text-sm"
                >
                  <div className="font-medium whitespace-normal break-words">{game.name}</div>
                  <div className="text-xs text-gray-500">App ID: {game.appid}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && searchInput && suggestions.length === 0 && !isLoading && gamesLoaded && games.length > 0 && (
        <div className="absolute top-full mt-1 min-w-[22rem] max-w-[32rem] bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded text-center py-2 text-sm text-gray-500 z-50">
          Aucun jeu trouvé
        </div>
      )}

      {isOpen && !isLoading && gamesLoaded && games.length === 0 && (
        <div className="absolute top-full mt-1 min-w-[22rem] max-w-[32rem] bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded text-center py-2 text-sm text-gray-500 z-50">
          Liste Steam indisponible
        </div>
      )}
    </div>
  );
};

export default SteamPropertyField;
