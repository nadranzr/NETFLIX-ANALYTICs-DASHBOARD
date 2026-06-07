/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Film, Tv, Play, Search, Clock, Calendar } from "lucide-react";
import { TopItem, ViewingRecord } from "../types";

// Simple local cache to keep poster URLs across sessions
const posterCache: Record<string, string | null> = {};

interface PosterItem {
  name: string;
  count: number;
  durationMin: number;
  mediaType: "show" | "movie";
  dateStr?: string;
}

interface MoviePostersProps {
  topShows: TopItem[];
  topMovies: TopItem[];
  records: ViewingRecord[];
}

export default function MoviePosters({ topShows, topMovies, records }: MoviePostersProps) {
  // Combine or separate titles
  const [filterType, setFilterType] = useState<"all" | "shows" | "movies">("all");
  const [searchWord, setSearchWord] = useState<string>("");
  const [sortMode, setSortMode] = useState<"recents" | "favourites">("recents");
  const [displayCount, setDisplayCount] = useState<number>(24);

  // Combine and compute datasets based on sortMode
  const allMediaItems = React.useMemo(() => {
    if (sortMode === "recents") {
      const map = new Map<string, { name: string; count: number; durationMin: number; mediaType: "show" | "movie"; dateStr: string }>();
      
      // records is sorted chronologically ascending, loop in reverse to get newest first
      for (let i = records.length - 1; i >= 0; i--) {
        const r = records[i];
        if (r.isSupplemental) continue; // skip trailers/previews
         
        const name = r.type === "show" ? r.seriesName : r.cleanTitle;
        if (!name) continue;
        
        if (!map.has(name)) {
          map.set(name, {
            name,
            count: 1,
            durationMin: r.durationMin,
            mediaType: r.type,
            dateStr: r.dateStr,
          });
        } else {
          const existing = map.get(name)!;
          existing.count += 1;
          existing.durationMin += r.durationMin;
        }
      }
      return Array.from(map.values());
    } else {
      // favourites -> ordered by durationMin
      const shows = topShows.map(s => ({ ...s, mediaType: "show" as const }));
      const movies = topMovies.map(m => ({ ...m, mediaType: "movie" as const }));
      return [...shows, ...movies].sort((a, b) => b.durationMin - a.durationMin);
    }
  }, [records, topShows, topMovies, sortMode]);

  // Filter list by mediaType or search pattern
  const filteredList = React.useMemo(() => {
    return allMediaItems.filter((m) => {
      const matchType = filterType === "all" || 
        (filterType === "shows" && m.mediaType === "show") ||
        (filterType === "movies" && m.mediaType === "movie");

      const matchSearch = m.name.toLowerCase().includes(searchWord.toLowerCase());
      return matchType && matchSearch;
    });
  }, [allMediaItems, filterType, searchWord]);

  return (
    <div id="movie-posters-gallery-section" className="bg-[#181818] p-6 rounded-2xl border border-gray-800/60 shadow-xl print-card">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-4 border-b border-gray-800">
        <div>
          <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <Film className="text-[#e50914]" size={20} />
            My Curated Theatre Shelf
          </h3>
          <p className="text-xs text-slate-400">
            Real dynamic movie key art fetched by matching your actual viewing titles.
          </p>
        </div>

        {/* Filters and Arrangement Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Arrange Toggle: Recents vs Favourites */}
          <div className="flex border border-gray-800 rounded-lg p-0.5 bg-[#0e0e0e] text-xs">
            <button
              onClick={() => {
                setSortMode("recents");
                setDisplayCount(24);
              }}
              className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1 ${sortMode === "recents" ? "bg-rose-600 text-white" : "text-gray-400 hover:text-white"}`}
              title="Sort by most recently viewed"
            >
              <Calendar size={12} />
              Recently Viewed
            </button>
            <button
              onClick={() => {
                setSortMode("favourites");
                setDisplayCount(24);
              }}
              className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1 ${sortMode === "favourites" ? "bg-rose-600 text-white" : "text-gray-400 hover:text-white"}`}
              title="Sort by total watch duration"
            >
              <Clock size={12} />
              Most Watched
            </button>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search title..."
              value={searchWord}
              onChange={(e) => setSearchWord(e.target.value)}
              className="bg-[#0f0f0f] border border-gray-800 px-3 pl-8 py-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-[#e50914] w-[140px] sm:w-[160px]"
            />
          </div>

          <div className="flex border border-gray-800 rounded-lg p-0.5 bg-[#0e0e0e] text-xs">
            <button
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 rounded font-medium transition ${filterType === "all" ? "bg-slate-800 text-white" : "text-gray-400"}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("shows")}
              className={`px-2.5 py-1 rounded font-medium transition ${filterType === "shows" ? "bg-slate-800 text-white" : "text-gray-400"}`}
            >
              Shows
            </button>
            <button
              onClick={() => setFilterType("movies")}
              className={`px-2.5 py-1 rounded font-medium transition ${filterType === "movies" ? "bg-slate-800 text-white" : "text-gray-400"}`}
            >
              Movies
            </button>
          </div>
        </div>
      </div>

      {filteredList.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          No viewing titles available with current search and filters.
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {filteredList.slice(0, displayCount).map((item, index) => (
              <PosterCard 
                key={`${sortMode}-${item.name}`} 
                item={item} 
                index={index}
                showRank={sortMode === "favourites"}
              />
            ))}
          </div>

          {filteredList.length > displayCount && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setDisplayCount(prev => prev + 24)}
                className="bg-slate-900 border border-gray-850 hover:bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-semibold cursor-pointer transition shadow-md"
              >
                Load More Titles ({filteredList.length - displayCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PosterCard: React.FC<{ 
  item: PosterItem; 
  index: number; 
  showRank: boolean; 
}> = ({ item, index, showRank }) => {
  const [posterUrl, setPosterUrl] = useState<string | null>(posterCache[item.name] || null);
  const [loading, setLoading] = useState<boolean>(!posterCache.hasOwnProperty(item.name));

  useEffect(() => {
    if (posterCache.hasOwnProperty(item.name)) {
      setPosterUrl(posterCache[item.name]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchPoster = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/movie-poster?q=${encodeURIComponent(item.name)}&t=${item.mediaType}`);
        if (!response.ok) throw new Error("Network response error");
        const data = await response.json();
        
        if (isMounted) {
          const url = data.posterUrl || null;
          posterCache[item.name] = url;
          setPosterUrl(url);
        }
      } catch (err) {
        if (isMounted) {
          posterCache[item.name] = null;
          setPosterUrl(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPoster();
    return () => {
      isMounted = false;
    };
  }, [item.name]);

  const viewHrs = Math.round(item.durationMin / 60);

  return (
    <div className="group bg-[#111] rounded-xl overflow-hidden border border-gray-850 hover:border-rose-600 transition-all duration-350 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:shadow-rose-950/20">
      
      {/* Poster image slot */}
      <div className="aspect-[2/3] relative w-full bg-[#1c1c1c] overflow-hidden flex flex-col justify-center items-center text-center">
        {loading ? (
          <div className="w-6 h-6 border-2 border-rose-600/20 border-t-rose-600 rounded-full animate-spin"></div>
        ) : posterUrl ? (
          <img
            src={posterUrl}
            alt={item.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="p-3">
            {item.mediaType === "show" ? (
              <Tv size={22} className="text-slate-600 mx-auto mb-1" />
            ) : (
              <Film size={22} className="text-slate-600 mx-auto mb-1" />
            )}
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block bg-[#2a2a2a] py-0.5 px-1 rounded truncate">
              {item.mediaType}
            </span>
          </div>
        )}

        {/* Hover overlay with a sleek play button */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-10 h-10 bg-[#e50914] rounded-full flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-300 shadow-lg shadow-black/40">
            <Play size={14} fill="white" className="text-white ml-0.5" />
          </div>
        </div>

        {/* Rank / Type badge on top left */}
        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/80 backdrop-blur text-[8px] font-mono font-black text-rose-500 rounded border border-rose-950/30">
          {showRank ? `#${index + 1}` : "Recent"}
        </span>
      </div>

      {/* Info panel */}
      <div className="p-2.5 flex-1 flex flex-col justify-between">
        <h4 className="text-[11px] font-bold text-gray-200 line-clamp-2 leading-tight group-hover:text-[#e50914] transition-colors">
          {item.name}
        </h4>
        <div className="flex flex-col gap-1 mt-1.5 border-t border-gray-900 pt-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-[#64748b] font-semibold uppercase tracking-wider">
              {item.mediaType}
            </span>
            <span className="text-[9px] font-mono font-black text-rose-400 bg-rose-950/20 px-1 py-0.5 rounded">
              {viewHrs > 0 ? `${viewHrs}h` : `${item.durationMin}m`}
            </span>
          </div>
          {item.dateStr && (
            <div className="text-[9px] text-gray-500 font-mono text-left">
              Watched: {item.dateStr}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
