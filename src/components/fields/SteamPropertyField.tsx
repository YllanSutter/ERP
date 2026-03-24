import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Loader } from 'lucide-react';
import { searchSteamGames, loadSteamGamesList, SteamGame } from '@/lib/plugins/steam/steamUtils';

interface SteamPropertyFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export const SteamPropertyField: React.FC<SteamPropertyFieldProps> = ({
  value = '',
  onChange,
  disabled = false
}) => {
  const [searchInput, setSearchInput] = useState(value);
  const [suggestions, setSuggestions] = useState<SteamGame[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [games, setGames] = useState<SteamGame[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger la liste Steam au montage
  useEffect(() => {
    const loadGames = async () => {
      setIsLoading(true);
      const loadedGames = await loadSteamGamesList();
      setGames(loadedGames);
      setIsLoading(false);
    };
    loadGames();
  }, []);

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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectGame = (game: SteamGame) => {
    setSearchInput(game.name);
    onChange?.(game.name);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchInput(newValue);
    onChange?.(newValue);
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchInput}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Rechercher un jeu Steam..."
          disabled={disabled || isLoading}
          className="w-full px-3 py-2 rounded border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-sm disabled:opacity-50"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader className="w-4 h-4 animate-spin" />
          </div>
        )}
        {!isLoading && suggestions.length > 0 && (
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded shadow-lg z-50">
          <ul className="max-h-64 overflow-y-auto">
            {suggestions.map((game, index) => (
              <li key={`${game.appid}-${index}`}>
                <button
                  onClick={() => handleSelectGame(game)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition text-sm"
                >
                  <div className="font-medium">{game.name}</div>
                  <div className="text-xs text-gray-500">App ID: {game.appid}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && searchInput && suggestions.length === 0 && !isLoading && (
        <div className="absolute top-full mt-1 w-full bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded text-center py-2 text-sm text-gray-500 z-50">
          Aucun jeu trouvé
        </div>
      )}
    </div>
  );
};

export default SteamPropertyField;
