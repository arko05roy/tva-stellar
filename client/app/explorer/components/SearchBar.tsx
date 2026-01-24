"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseSearchInput } from "../lib/formatter";
import { useBlockscoutSearch, useIsBlockscoutEnabled } from "../hooks/useBlockscout";

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  darkMode?: boolean;
}

export function SearchBar({
  className = "",
  placeholder = "Search by Block / Tx Hash / Address",
  darkMode = false,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  const isBlockscoutEnabled = useIsBlockscoutEnabled();
  const { data: searchResults, isLoading: isSearching } = useBlockscoutSearch(
    showSuggestions && query.length >= 2 ? query : null
  );

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;

    setError(null);
    setShowSuggestions(false);
    const { type, value } = parseSearchInput(query);

    switch (type) {
      case "block":
        router.push(`/explorer/blocks/${value}`);
        break;
      case "transaction":
        router.push(`/explorer/tx/${value}`);
        break;
      case "address":
        router.push(`/explorer/address/${value}`);
        break;
      default:
        setError("Invalid search query. Enter a block number, transaction hash, or address.");
    }
  }, [query, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    [handleSearch]
  );

  const handleSuggestionClick = (item: any) => {
    setShowSuggestions(false);
    if (item.address) {
      router.push(`/explorer/address/${item.address}`);
    } else if (item.tx_hash) {
      router.push(`/explorer/tx/${item.tx_hash}`);
    } else if (item.block_hash) {
      router.push(`/explorer/blocks/${item.block_hash}`);
    }
  };

  if (darkMode) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
                setShowSuggestions(e.target.value.length >= 2);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => query.length >= 2 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={placeholder}
              className="w-full px-4 py-3 pr-12 border border-white/10 rounded-xl font-mono text-sm bg-white/5 text-white placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FFC800] focus:ring-2 focus:ring-[#FFC800]/20 transition-all"
            />
            <button
              onClick={handleSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Search"
            >
              {isSearching ? (
                <svg
                  className="w-5 h-5 text-[#FFC800] animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-[#B0B0B0] hover:text-[#FFC800]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && isBlockscoutEnabled && searchResults?.items && searchResults.items.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
            {searchResults.items.slice(0, 5).map((item: any, index: number) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(item)}
                className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 border-b border-white/5 last:border-0"
              >
                <div className="w-8 h-8 rounded-lg bg-[#9B7FFF]/10 flex items-center justify-center shrink-0">
                  <span className="text-[#9B7FFF] text-xs font-bold">
                    {item.type === "address" ? "A" : item.type === "transaction" ? "TX" : "B"}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <div className="text-sm text-white font-mono truncate">
                    {item.address || item.tx_hash || item.block_hash}
                  </div>
                  <div className="text-xs text-[#B0B0B0] capitalize">{item.type}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="absolute top-full left-0 mt-2 text-sm text-red-400 bg-red-500/10 px-3 py-1 rounded-lg">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
              setShowSuggestions(e.target.value.length >= 2);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={placeholder}
            className="w-full px-4 py-3 pr-12 border border-black/10 rounded-xl font-mono text-sm bg-white focus:outline-none focus:border-[#0055ff] focus:ring-2 focus:ring-[#0055ff]/10 transition-all"
          />
          <button
            onClick={handleSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            aria-label="Search"
          >
            {isSearching ? (
              <svg
                className="w-5 h-5 text-[#0055ff] animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-black/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Search Suggestions */}
      {showSuggestions && isBlockscoutEnabled && searchResults?.items && searchResults.items.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden z-50">
          {searchResults.items.slice(0, 5).map((item: any, index: number) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(item)}
              className="w-full px-4 py-3 text-left hover:bg-black/5 transition-colors flex items-center gap-3 border-b border-black/5 last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0055ff]/10 flex items-center justify-center shrink-0">
                <span className="text-[#0055ff] text-xs font-bold">
                  {item.type === "address" ? "A" : item.type === "transaction" ? "TX" : "B"}
                </span>
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-mono truncate">
                  {item.address || item.tx_hash || item.block_hash}
                </div>
                <div className="text-xs text-black/40 capitalize">{item.type}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="absolute top-full left-0 mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
