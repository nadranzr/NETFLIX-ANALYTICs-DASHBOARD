/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Upload,
  Play,
  Flame,
  Clock,
  Film,
  Tv,
  Search,
  Sparkles,
  FileText,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  FolderSync
} from "lucide-react";
import { parseNetflixCSV } from "./utils/csvParser";
import { calculateAnalytics } from "./utils/analytics";
import { DEMO_NETFLIX_CSV } from "./utils/demoData";
import { ViewingRecord, AIInsightResponse } from "./types";
import Charts from "./components/Charts";
import MoviePosters from "./components/MoviePosters";

export default function App() {
  const [csvRaw, setCsvRaw] = useState<string>("");
  const [records, setRecords] = useState<ViewingRecord[]>([]);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");
  const [uploadTime, setUploadTime] = useState<string>("");

  // Filters state
  const [selectedProfile, setSelectedProfile] = useState<string>("All Profiles");
  const [selectedDevice, setSelectedDevice] = useState<string>("All Devices");
  const [selectedType, setSelectedType] = useState<"all" | "show" | "movie">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "binge" | "raw" | "posters">("overview");
  const [showDuration, setShowDuration] = useState<boolean>(true); // Hours vs count

  // AI insights state
  const [aiInsights, setAiInsights] = useState<AIInsightResponse | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [errorAI, setErrorAI] = useState<string | null>(null);

  // Load demo database initially so the application doesn't open to a blank page
  useEffect(() => {
    loadDemo();
  }, []);

  const loadDemo = () => {
    setCsvRaw(DEMO_NETFLIX_CSV);
    const parsed = parseNetflixCSV(DEMO_NETFLIX_CSV);
    setRecords(parsed);
    setIsDemo(true);
    setFileName("NetflixViewingHistory_Demo.csv");
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setUploadTime(now);

    // Reset filters
    setSelectedProfile("All Profiles");
    setSelectedDevice("All Devices");
    setSearchQuery("");
    setAiInsights(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvRaw(text);
      const parsed = parseNetflixCSV(text);
      setRecords(parsed);
      setIsDemo(false);
      setFileName(file.name);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setUploadTime(now);

      // Reset filters & analytics
      setSelectedProfile("All Profiles");
      setSelectedDevice("All Devices");
      setSearchQuery("");
      setAiInsights(null);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvRaw(text);
      const parsed = parseNetflixCSV(text);
      setRecords(parsed);
      setIsDemo(false);
      setFileName(file.name);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setUploadTime(now);

      setSelectedProfile("All Profiles");
      setSelectedDevice("All Devices");
      setSearchQuery("");
      setAiInsights(null);
    };
    reader.readAsText(file);
  };

  // Extract unique filters from the records
  const uniqueProfiles = useMemo(() => {
    const list = records.map(r => r.profile);
    return ["All Profiles", ...Array.from(new Set(list))];
  }, [records]);

  const uniqueDevices = useMemo(() => {
    const list = records.map(r => r.device);
    return ["All Devices", ...Array.from(new Set(list)).filter(d => d !== "Unknown")];
  }, [records]);

  // Apply basic filters to records before calculating analytics
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesProfile = selectedProfile === "All Profiles" || r.profile === selectedProfile;
      const matchesDevice = selectedDevice === "All Devices" || r.device === selectedDevice;
      const matchesType = selectedType === "all" || r.type === selectedType;
      
      const cleanSearch = searchQuery.toLowerCase().trim();
      const matchesSearch = !cleanSearch || 
        r.rawTitle.toLowerCase().includes(cleanSearch) || 
        r.seriesName.toLowerCase().includes(cleanSearch) ||
        (r.episodeName && r.episodeName.toLowerCase().includes(cleanSearch)) ||
        r.device.toLowerCase().includes(cleanSearch);

      return matchesProfile && matchesDevice && matchesType && matchesSearch;
    });
  }, [records, selectedProfile, selectedDevice, selectedType, searchQuery]);

  // Compute stats on the filtered subset
  const analytics = useMemo(() => {
    return calculateAnalytics(filteredRecords);
  }, [filteredRecords]);

  // Request AI Insights from backend
  const generateAIInsights = async () => {
    if (filteredRecords.length === 0) return;
    setLoadingAI(true);
    setErrorAI(null);

    try {
      const response = await fetch("/api/analyze-habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topShows: analytics.topShows,
          topMovies: analytics.topMovies,
          summary: analytics.summary
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      setAiInsights(data);
    } catch (err: any) {
      console.error(err);
      setErrorAI(err.message || "Something went wrong generating your viewing personality.");
    } finally {
      setLoadingAI(false);
    }
  };

  // Safe percentage helper for Progress bars
  const maxShowCount = analytics.topShows[0]?.durationMin || 1;
  const maxMovieCount = analytics.topMovies[0]?.durationMin || 1;

  // Print handle
  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="w-full min-h-screen bg-[#0f0f0f] text-gray-200 flex flex-col antialiased">
      
      {/* HEADER SECTION (Theatre Sleek style) */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 bg-[#141414] border-b border-gray-800 gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#e50914] rounded-lg flex items-center justify-center shadow-lg shadow-rose-900/20">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 18v-6l5 3-5 3zm12-11c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white italic font-display">
              FLIX<span className="font-normal text-gray-400 not-italic">ANALYTICS</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-mono tracking-wider">PERSONAL VIEWING ARCHITECTURE</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {fileName && (
            <div className="hidden md:flex flex-col text-right mr-2">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono">
                Active Source
              </span>
              <span className={`text-xs ${isDemo ? 'text-amber-400' : 'text-emerald-400'} font-medium truncate max-w-[200px]`}>
                {fileName} {isDemo ? "(Demo)" : ""}
              </span>
            </div>
          )}

          <label className="bg-[#1c1c1c] hover:bg-[#252525] border border-gray-800 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
            <Upload size={14} className="text-[#e50914]" />
            Upload My History
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>

          {isDemo ? (
            <span className="text-[10px] text-amber-500 font-medium px-2 py-1 bg-amber-950/40 border border-amber-900/60 rounded">
              Using Demo Dataset
            </span>
          ) : (
            <button 
              onClick={loadDemo}
              className="bg-[#1c1c1c] border border-gray-800 hover:bg-[#252525] text-[11px] text-slate-400 px-3 py-1.5 rounded-lg transition"
              title="Switch back to demo data to explore features"
            >
              Reset to Demo
            </button>
          )}

          <button 
            onClick={triggerPrint}
            className="bg-white text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors shadow-md shadow-white/5 active:scale-95"
          >
            EXPORT PDF
          </button>
        </div>
      </header>

      {/* DRAG & DROP ZONE & BRIEF INSTRUCTIONS FOR BEGINNERS (Only show if file isn't populated or as a small help tip) */}
      <div className="no-print select-none">
        {records.length === 0 ? (
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="m-6 p-12 border-2 border-dashed border-gray-800 hover:border-[#e50914]/50 rounded-2xl bg-[#141414]/50 text-center transition-all flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mb-4 border border-gray-800">
              <Upload size={28} className="text-[#e50914]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Drop your Netflix viewing history CSV here</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-6 leading-relaxed">
              Netflix allows you to export your entire history. Drop the <code className="text-rose-400 px-1 bg-slate-900 rounded font-mono text-xs">ViewingActivity.csv</code> file here, or click to browse.
            </p>
            <div className="flex gap-4">
              <label className="bg-[#e50914] hover:bg-red-700 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition">
                Browse Files
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
              <button 
                onClick={loadDemo}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2 rounded-xl text-xs font-semibold"
              >
                Explore with Demo Data
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#1c1917]/20 border-b border-gray-900/60 text-xs px-6 py-2.5 flex flex-wrap justify-between items-center text-slate-400 gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Loaded <strong>{records.length}</strong> total interactions chronologically.</span>
            </div>
            <div className="flex gap-4 text-[11px]">
              <span>💡 <strong className="text-rose-400">Pro-tip:</strong> Netflix detailed records include profile name & seconds watched.</span>
              <a 
                href="https://www.netflix.com/youraccount" 
                target="_blank" 
                rel="noreferrer" 
                className="text-white underline hover:text-[#e50914]"
              >
                How to get mine?
              </a>
            </div>
          </div>
        )}
      </div>

      {records.length > 0 && (
        <>
          {/* CONTROL BAR: Search, Filters, and Navigation */}
          <section className="bg-[#141414] border-b border-gray-800 py-3.5 px-6 no-print">
            <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
              
              {/* Category Navigation Tabs */}
              <div className="flex bg-[#0f0f0f] border border-gray-800 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "overview" ? "bg-[#e50914] text-white shadow-md shadow-rose-950/20" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Overview & AI
                </button>
                <button
                  onClick={() => setActiveTab("trends")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "trends" ? "bg-[#e50914] text-white shadow-md shadow-rose-950/20" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Interactive Charts
                </button>
                <button
                  onClick={() => setActiveTab("binge")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "binge" ? "bg-[#e50914] text-white shadow-md shadow-rose-950/20" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Binge & Streaks
                </button>
                <button
                  onClick={() => setActiveTab("raw")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "raw" ? "bg-[#e50914] text-white shadow-md shadow-rose-950/20" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Raw Viewing List
                </button>
                <button
                  onClick={() => setActiveTab("posters")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "posters" ? "bg-[#e50914] text-white shadow-md shadow-rose-950/20" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Movie Posters
                </button>
              </div>

              {/* Dynamic Filtering Panel */}
              <div className="flex flex-wrap items-center gap-3 flex-1 lg:justify-end">
                {/* Search Text */}
                <div className="relative flex-1 max-w-[280px] min-w-[150px]">
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search shows or movies..."
                    className="w-full bg-[#0f0f0f] border border-gray-800 pr-3 pl-9 py-1.5 rounded-xl text-xs text-white focus:outline-none focus:border-[#e50914] placeholder-gray-500 placeholder:text-xs"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")} 
                      className="absolute right-3 top-2 text-xs text-gray-500 hover:text-white"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Profile Filter (If more than 1 loaded) */}
                {uniqueProfiles.length > 2 && (
                  <div className="flex items-center space-x-1">
                    <Filter size={12} className="text-gray-500 mr-1" />
                    <select
                      value={selectedProfile}
                      onChange={(e) => setSelectedProfile(e.target.value)}
                      className="bg-[#0f0f0f] border border-gray-800 text-xs text-slate-200 py-1.5 px-3 rounded-xl focus:outline-none"
                    >
                      {uniqueProfiles.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Device Filter */}
                {uniqueDevices.length > 2 && (
                  <select
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="bg-[#0f0f0f] border border-gray-800 text-xs text-slate-200 py-1.5 px-3 rounded-xl focus:outline-none"
                  >
                    {uniqueDevices.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}

                {/* Type Filter */}
                <div className="flex border border-gray-800 rounded-xl overflow-hidden p-0.5 bg-[#0e0e0e]">
                  <button
                    onClick={() => setSelectedType("all")}
                    className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-lg ${selectedType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedType("show")}
                    className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-lg ${selectedType === 'show' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                  >
                    TV
                  </button>
                  <button
                    onClick={() => setSelectedType("movie")}
                    className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-lg ${selectedType === 'movie' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                  >
                    Movie
                  </button>
                </div>

                {/* Metric Unit Toggle */}
                <div className="flex items-center space-x-2 border-l border-gray-800 pl-3">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Metric</span>
                  <button
                    onClick={() => setShowDuration(!showDuration)}
                    className="bg-[#1c1c1c] border border-gray-800 text-[10px] font-bold py-1 px-2.5 rounded-lg text-rose-400 hover:bg-slate-900 transition"
                  >
                    {showDuration ? "Hours" : "Titles Count"}
                  </button>
                </div>
              </div>

            </div>
          </section>

          {/* MAIN GRID BODY */}
          <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full space-y-6">

            {/* QUICK STATS ROW */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Total Watch Time */}
              <div className="bg-[#181818] rounded-xl p-4 border border-gray-800/50 flex flex-col justify-center shadow-lg relative overflow-hidden group hover:border-[#e50914]/20 transition-colors duration-300 print-card">
                <div className="absolute right-2 top-2 text-[#e50914]/10 group-hover:text-[#e50914]/20 transition-colors">
                  <Clock size={40} strokeWidth={1} />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                  Total Watch Time
                </p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
                    {Math.round(analytics.summary.totalWatchTimeMin / 60).toLocaleString()}
                  </h2>
                  <span className="text-xs text-gray-500 font-medium">Hours</span>
                </div>
                <p className="text-[10px] text-green-500 mt-1 font-mono">
                  {Math.round(analytics.summary.totalWatchTimeMin / 10).toLocaleString()} Minutes logged
                </p>
              </div>

              {/* Total Titles Count */}
              <div className="bg-[#181818] rounded-xl p-4 border border-gray-800/50 flex flex-col justify-center shadow-lg relative overflow-hidden group hover:border-[#e50914]/20 transition-colors duration-300 print-card">
                <div className="absolute right-2 top-2 text-[#e50914]/10 group-hover:text-[#e50914]/20 transition-colors">
                  <Tv size={40} strokeWidth={1} />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                  Titles Watched
                </p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
                    {analytics.summary.totalRecords.toLocaleString()}
                  </h2>
                  <span className="text-xs text-gray-500 font-medium">Episodes & Films</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  {analytics.summary.totalUniqueShows} shows • {analytics.summary.totalUniqueMovies} movies
                </p>
              </div>

              {/* Longest viewing streak */}
              <div className="bg-[#181818] rounded-xl p-4 border border-gray-800/50 flex flex-col justify-center shadow-lg relative overflow-hidden group hover:border-[#e50914]/20 transition-colors duration-300 print-card">
                <div className="absolute right-2 top-2 text-[#e50914]/10 group-hover:text-[#e50914]/20 transition-colors font-mono">
                  <Flame size={40} strokeWidth={1} />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                  Longest Streak
                </p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
                    {analytics.longestStreaks.length}
                  </h2>
                  <span className="text-xs text-gray-500 font-medium">Days</span>
                </div>
                {analytics.longestStreaks.length > 0 ? (
                  <p className="text-[10px] text-[#e50914] font-semibold mt-1 truncate">
                    {analytics.longestStreaks.start} to {analytics.longestStreaks.end}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-600 mt-1">No streaks logged yet</p>
                )}
              </div>

              {/* Binge Metric Index */}
              <div className="bg-[#181818] rounded-xl p-4 border border-gray-800/50 flex flex-col justify-center shadow-lg relative overflow-hidden group hover:border-[#e50914]/20 transition-colors duration-300 print-card">
                <div className="absolute right-2 top-2 text-[#e50914]/10 group-hover:text-[#e50914]/20 transition-colors">
                  <Layers size={40} strokeWidth={1} />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                  Binge Index
                </p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
                    {analytics.bingeSessions.length}
                  </h2>
                  <span className="text-xs text-gray-500 font-medium">Active Days</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  💥 Days with ≥ 3 episodes of same series
                </p>
              </div>

            </section>

            {/* TAB VIEWPORTS */}
            
            {/* TAB 1: OVERVIEW & AI */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                {/* Visual Highlights & Side stats */}
                <div className="xl:col-span-8 space-y-6">
                  
                  {/* AI viewing insights box */}
                  <div className="bg-gradient-to-br from-[#1b1212] to-[#0d0d0c] rounded-2xl p-6 border border-rose-950/40 relative overflow-hidden shadow-2xl print-card">
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                      <Sparkles size={120} className="text-rose-500" />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-[#e50914]/20 p-2 rounded-lg text-[#e50914]">
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <h3 className="text-md font-bold text-white font-display">
                            Gemini AI Viewing Personality Report
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Let AI compile your Netflix traits, genres, and recommended titles list.
                          </p>
                        </div>
                      </div>
                      
                      {!aiInsights && (
                        <button
                          onClick={generateAIInsights}
                          disabled={loadingAI}
                          className="bg-white hover:bg-slate-200 text-black px-4 py-2 font-bold rounded-xl text-xs flex items-center gap-2 transition disabled:opacity-50 active:scale-95 text-center self-start sm:self-auto"
                        >
                          {loadingAI ? (
                            <>
                              <FolderSync size={13} className="animate-spin" />
                              Analyzing History...
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} />
                              Generate Personality Report
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {loadingAI && (
                      <div className="py-12 flex flex-col items-center text-center space-y-3">
                        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin"></div>
                        <p className="text-xs text-rose-200 font-mono tracking-wider">
                          Deducing watching routines, favorite genres, & thematic links...
                        </p>
                      </div>
                    )}

                    {errorAI && (
                      <div className="bg-rose-950/30 border border-rose-900/60 p-4 rounded-xl flex items-start gap-2 text-rose-200 text-xs">
                        <AlertCircle className="flex-shrink-0 text-rose-500 mt-0.5" size={14} />
                        <div>
                          <p className="font-semibold mb-1">Analytical Hitch</p>
                          <p className="opacity-90">{errorAI}</p>
                          <button 
                            onClick={generateAIInsights}
                            className="underline text-white font-semibold mt-2 block"
                          >
                            Try again
                          </button>
                        </div>
                      </div>
                    )}

                    {aiInsights && !loadingAI && (
                      <div className="space-y-6">
                        {/* Title and Witty summary */}
                        <div className="bg-rose-950/15 border border-rose-900/30 p-4 rounded-xl">
                          <span className="text-[9px] uppercase tracking-widest font-black text-rose-400 block mb-1">
                            Your Certified Netflix Profile Label
                          </span>
                          <h4 className="text-lg font-black text-white italic font-display uppercase tracking-tight">
                            "{aiInsights.personalityTitle}"
                          </h4>
                          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                            {aiInsights.personalityDescription}
                          </p>
                        </div>

                        {/* Split block: 3 Key Insights & Favorite predicted Genres */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1.5 font-mono">
                              <CheckCircle2 size={13} className="text-rose-500" />
                              Observation Facts
                            </h5>
                            <ul className="space-y-2 text-xs">
                              {aiInsights.keyInsights.map((insight, idx) => (
                                <li key={idx} className="bg-slate-900/45 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                                  {insight}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1.5 font-mono">
                              <Layers size={13} className="text-rose-500" />
                              Custom Genre Distribution
                            </h5>
                            <div className="space-y-2.5">
                              {aiInsights.inferredGenres.map((inf, idx) => (
                                <div key={idx} className="space-y-1">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="font-semibold text-slate-200">{inf.genre}</span>
                                    <span className="text-rose-400 font-mono font-bold">{inf.percentage}%</span>
                                  </div>
                                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-[#e50914] h-1 rounded-full transition-all duration-500"
                                      style={{ width: `${inf.percentage}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-400 block leading-tight">{inf.explanation}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* AI Customized Netflix Show suggestions */}
                        <div className="pt-4 border-t border-gray-800/60">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1">
                            <Play size={10} fill="currentColor" className="text-rose-500 mr-1" />
                            Next Queue Recommendations (Currently on Netflix)
                          </h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {aiInsights.recommendations.map((rec, i) => (
                              <div key={i} className="bg-[#121212] border border-gray-800 p-3.5 rounded-xl hover:border-rose-950 transition relative group">
                                <span className="absolute top-2 right-2 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/50">
                                  {rec.fitScore}% FIT
                                </span>
                                <div className="flex items-center gap-2 mb-1.5">
                                  {rec.type === "show" ? (
                                    <Tv size={13} className="text-slate-400" />
                                  ) : (
                                    <Film size={13} className="text-slate-400" />
                                  )}
                                  <span className="text-xs font-black text-white">{rec.title}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-normal">{rec.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}

                    {!aiInsights && !loadingAI && (
                      <div className="py-6 flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                          Your viewing lists can be sent to Gemini AI (server-proxied) to identify genres, extract behavior metrics, and recommend currently-playing Netflix shows.
                        </p>
                        <button
                          onClick={generateAIInsights}
                          className="border border-[#e50914] hover:bg-[#e50914] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Sparkles size={12} />
                          Analyze with Gemini
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Primary charts snapshot inside the Overview Tab */}
                  <div className="bg-[#181818] rounded-2xl p-6 border border-gray-800/50 print-card">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="text-md font-bold text-white font-display">Activity Heatmap Routine</h4>
                        <p className="text-xs text-gray-500">Overview of days and hours that keep you glued to your screen.</p>
                      </div>
                      <button
                        onClick={() => setActiveTab("trends")}
                        className="text-[11px] text-rose-500 hover:underline font-semibold flex items-center gap-1"
                      >
                        All Charts
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    <Charts 
                      dayOfWeekTrends={analytics.dayOfWeekTrends}
                      monthlyTrends={analytics.monthlyTrends}
                      yearlyTrends={analytics.yearlyTrends}
                      heatmapData={analytics.heatmapData}
                      showDuration={showDuration}
                    />
                  </div>

                </div>

                {/* Left Side elements: Top shows list, series stats progress bars */}
                <div className="xl:col-span-4 space-y-6">
                  
                  {/* Top TV Shows Sidebar */}
                  <div className="bg-[#181818] rounded-2xl p-5 border border-gray-800/50 flex flex-col print-card">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-800/50 pb-3">
                      <div className="flex items-center gap-2">
                        <Tv size={16} className="text-[#e50914]" />
                        <h3 className="text-sm font-bold text-white">Most Watched Shows</h3>
                      </div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-bold">
                        {analytics.topShows.length} Total
                      </span>
                    </div>

                    {analytics.topShows.length === 0 ? (
                      <p className="text-xs text-gray-500 italic py-6">No TV shows match your filters.</p>
                    ) : (
                      <div className="space-y-4">
                        {analytics.topShows.slice(0, 5).map((show, i) => {
                          const pct = Math.max(10, Math.round((show.durationMin / maxShowCount) * 100));
                          return (
                            <div key={show.name} className="flex items-center gap-3">
                              <span className="w-6 text-sm font-black text-gray-600 font-mono">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between mb-1 text-xs">
                                  <span className="font-bold text-slate-200 truncate pr-2">{show.name}</span>
                                  <span className="text-slate-400 font-mono flex-shrink-0">
                                    {showDuration ? `${Math.round(show.durationMin / 60)}h` : `${show.count}eps`}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-[#e50914] h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => setActiveTab("posters")}
                      className="mt-4 w-full py-2 bg-slate-900/60 border border-slate-800/85 hover:border-rose-950 rounded-xl text-center text-[10px] uppercase tracking-widest font-bold hover:bg-[#e50914]/10 text-rose-400 transition cursor-pointer"
                    >
                      Browse TV Poster Art
                    </button>
                  </div>

                  {/* Top Movies Sidebar */}
                  <div className="bg-[#181818] rounded-2xl p-5 border border-gray-800/50 flex flex-col print-card animate-fadeIn">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-800/50 pb-3">
                      <div className="flex items-center gap-2">
                        <Film size={16} className="text-[#e50914]" />
                        <h3 className="text-sm font-bold text-white">Most Watched Movies</h3>
                      </div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-bold">
                        {analytics.topMovies.length} Total
                      </span>
                    </div>

                    {analytics.topMovies.length === 0 ? (
                      <p className="text-xs text-gray-500 italic py-6">No movies match your filters.</p>
                    ) : (
                      <div className="space-y-4">
                        {analytics.topMovies.slice(0, 5).map((movie, i) => {
                          const pct = Math.max(10, Math.round((movie.durationMin / maxMovieCount) * 100));
                          return (
                            <div key={movie.name} className="flex items-center gap-3">
                              <span className="w-6 text-sm font-black text-gray-600 font-mono">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between mb-1 text-xs">
                                  <span className="font-bold text-slate-200 truncate pr-2">{movie.name}</span>
                                  <span className="text-slate-400 font-mono flex-shrink-0">
                                    {showDuration ? `${Math.round(movie.durationMin / 60)}h` : `${movie.count} views`}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-slate-400 h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => setActiveTab("posters")}
                      className="mt-4 w-full py-2 bg-slate-900/60 border border-slate-800/85 hover:border-rose-950 rounded-xl text-center text-[10px] uppercase tracking-widest font-bold hover:bg-[#e50914]/10 text-rose-400 transition cursor-pointer"
                    >
                      Browse Film Poster Art
                    </button>
                  </div>

                  {/* Completion Circular percentage and other auxiliary behaviors */}
                  <div className="bg-gradient-to-br from-[#181818] to-[#121212] rounded-2xl p-5 border border-gray-800/50 print-card">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Habit Key Ratios</h4>
                    <div className="space-y-4 font-mono text-xs">
                      
                      <div className="border border-slate-800 p-3 rounded-xl bg-slate-950/20 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Supplementals Ratio</span>
                          <span className="text-sm font-bold text-slate-200">
                            {records.length > 0 
                              ? `${Math.round((records.filter(r => r.isSupplemental).length / records.length) * 100)}%`
                              : "0%"}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 text-right max-w-[120px] leading-tight">
                          Previews, trailers, and automatic clips skipped.
                        </span>
                      </div>

                      <div className="border border-slate-800 p-3 rounded-xl bg-slate-950/20 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Average Duration</span>
                          <span className="text-sm font-bold text-slate-200">
                            {filteredRecords.length > 0 
                              ? `${Math.round(filteredRecords.reduce((sum, r) => sum + r.durationMin, 0) / filteredRecords.length)} min`
                              : "0 min"}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 text-right max-w-[120px] leading-tight">
                          Per stream session interaction.
                        </span>
                      </div>

                      <div className="border border-slate-800 p-3 rounded-xl bg-slate-950/20 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Unique Watchdates</span>
                          <span className="text-sm font-bold text-slate-200">
                            {Array.from(new Set(filteredRecords.map(r => r.dateStr))).length} Days
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 text-right max-w-[120px] leading-tight">
                          Total separate calendar days logged.
                        </span>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: DETAILED CHARTS */}
            {activeTab === "trends" && (
              <div className="space-y-6">
                
                {/* Highlight banner in Charts Tab */}
                <div className="bg-[#181818] rounded-2xl p-5 border border-gray-800/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-md font-bold text-white font-display">Historical Watching Visualizations</h3>
                    <p className="text-xs text-slate-400">
                      Explore detailed monthly patterns, day distributions, and yearly viewing ratios. Use the metric filters on the right to toggle between Viewing Count & Hours Watched.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowDuration(true)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-semibold ${showDuration ? 'bg-[#e50914] text-white border-[#e50914]' : 'bg-[#141414] text-slate-400 border-gray-800 hover:text-white'}`}
                    >
                      Duration (Hours)
                    </button>
                    <button
                      onClick={() => setShowDuration(false)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-semibold ${!showDuration ? 'bg-[#e50914] text-white border-[#e50914]' : 'bg-[#141414] text-slate-400 border-gray-800 hover:text-white'}`}
                    >
                      Title Log Counts
                    </button>
                  </div>
                </div>

                <Charts 
                  dayOfWeekTrends={analytics.dayOfWeekTrends}
                  monthlyTrends={analytics.monthlyTrends}
                  yearlyTrends={analytics.yearlyTrends}
                  heatmapData={analytics.heatmapData}
                  showDuration={showDuration}
                />

                {/* Additional Yearly visual trend panel */}
                <div className="bg-[#181818] rounded-2xl p-6 border border-gray-800/50 print-card">
                  <h4 className="text-sm font-bold text-white mb-2 font-display">Year-by-Year Streaming Summary</h4>
                  <p className="text-xs text-slate-400 mb-6">Comparison of your total active streaming behavior across calendar years logged.</p>
                  
                  {analytics.yearlyTrends.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-6 text-center">No yearly trends found.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {analytics.yearlyTrends.map((yr) => (
                        <div key={yr.label} className="bg-[#111] border border-gray-800/60 p-4 rounded-xl text-center">
                          <span className="text-2xl font-black text-white block mb-1 font-display">{yr.label}</span>
                          <div className="text-xs font-semibold text-rose-500 font-mono mb-1">
                            {Math.round(yr.durationMin / 60)} Hours Streaming
                          </div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                            {yr.count} titles watched
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: BINGED WATCHING & STREAKS DETAIL */}
            {activeTab === "binge" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Streaks Log highlights chart */}
                <div className="lg:col-span-4 space-y-6">
                  
                  <div className="bg-[#181818] rounded-2xl p-5 border border-gray-800/50 relative overflow-hidden print-card">
                    <div className="absolute right-4 top-4 text-[#e50914]/10">
                      <Flame size={80} strokeWidth={1} />
                    </div>

                    <h3 className="text-sm font-bold text-white mb-4">Longest Viewing Streaks</h3>
                    <p className="text-xs text-slate-400 mb-6 font-sans">
                      A "streak" lists consecutive calendar days with at least one movie or show episode played. Consistently viewing Netflix builds streak counts.
                    </p>

                    <div className="text-center py-6 bg-slate-950/30 rounded-xl border border-slate-900 mb-6">
                      <Flame size={48} className="text-[#e50914] mx-auto mb-2 animate-bounce" />
                      <span className="text-4xl font-black text-white font-display block">
                        {analytics.longestStreaks.length}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">
                        Consecutive Days
                      </span>
                    </div>

                    {analytics.longestStreaks.length > 0 ? (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="flex justify-between border-b border-gray-800/60 pb-2">
                          <span className="text-slate-500">Streak Start</span>
                          <span className="text-slate-200">{analytics.longestStreaks.start}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Streak End</span>
                          <span className="text-slate-200">{analytics.longestStreaks.end}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No streaks registered.</p>
                    )}
                  </div>

                  {/* Bingeing definition card */}
                  <div className="bg-[#181818] rounded-2xl p-5 border border-gray-800/50 text-xs text-slate-400 leading-relaxed print-card">
                    <h4 className="font-bold text-white mb-2 flex items-center gap-1">
                      <AlertCircle className="text-rose-500" size={14} />
                      How we define a Binge Session
                    </h4>
                    <p className="mb-3">
                      Our system scans your calendar days and groups TV series titles. If you watch <strong>3 or more episodes of the exact same show</strong> on a single day, it is certified as a binge session.
                    </p>
                    <p>
                      Movies are excluded from binge statistics, focusing purely on narrative episodes played back-to-back.
                    </p>
                  </div>

                </div>

                {/* Binge Sessions List */}
                <div className="lg:col-span-8 bg-[#181818] rounded-2xl p-6 border border-gray-800/50 print-card">
                  <div className="flex justify-between items-center mb-6 border-b border-gray-800/50 pb-4">
                    <div>
                      <h3 className="text-md font-bold text-white font-display">Binge-Watching Sessions</h3>
                      <p className="text-xs text-slate-400">Shows you watched extensively in a single day.</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#e50914] bg-rose-950/30 px-3 py-1 rounded-full border border-rose-900/45">
                      {analytics.bingeSessions.length} sessions detected
                    </span>
                  </div>

                  {analytics.bingeSessions.length === 0 ? (
                    <div className="py-12 flex flex-col items-center text-center space-y-2">
                      <Tv size={32} className="text-slate-600" />
                      <p className="text-xs text-slate-400">No major single-day bingeing recorded (with 3+ episodes of same series).</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                      {analytics.bingeSessions.map((session, idx) => (
                        <div 
                          key={`${session.dateStr}-${session.seriesName}-${idx}`}
                          className="bg-[#121212] border border-gray-800/60 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <span className="text-[10px] text-[#e50914] font-mono font-bold tracking-wider uppercase">
                              {session.dateStr}
                            </span>
                            <h4 className="text-xs font-bold text-white">{session.seriesName}</h4>
                            <p className="text-[10px] text-slate-400 max-w-[400px] truncate leading-normal" title={session.episodes.join(", ")}>
                              Episodes: {session.episodes.join(" • ")}
                            </p>
                          </div>

                          <div className="flex gap-4 items-center">
                            <div className="text-right text-xs">
                              <span className="font-extrabold text-white block">{session.episodeCount} Episodes</span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                ~{Math.round(session.durationMin / 60)}h logged
                              </span>
                            </div>
                            <span className="w-2 h-8 bg-red-600 rounded"></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 4: RAW TRANSACTION LIST */}
            {activeTab === "raw" && (
              <div className="bg-[#181818] rounded-2xl p-6 border border-gray-800/50 print-card">
                
                {/* Search query options */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-md font-bold text-white font-display">Archived Viewing Record File</h3>
                    <p className="text-xs text-slate-400">Complete searchable database of your Netflix interaction exports.</p>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    Showing {filteredRecords.length} of {records.length} records.
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-800/70">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#121212] text-slate-400 border-b border-gray-800 uppercase text-[10px] font-bold font-mono tracking-wider">
                        <th className="py-3 px-4">Profile</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Date Cleaned</th>
                        <th className="py-3 px-4">Series/Movie Title Name</th>
                        <th className="py-3 px-4 text-right">Length</th>
                        <th className="py-3 px-4 hidden md:table-cell">Device Watcher</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50 bg-[#161616]">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                            No streaming records found match your current search queries or filter choices.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.slice(0, 100).map((record, index) => (
                          <tr key={record.id} className="hover:bg-slate-900/60 transition duration-150">
                            <td className="py-3 px-4 text-[#e50914] font-medium font-mono">{record.profile}</td>
                            <td className="py-3 px-4 uppercase text-[9px] font-bold">
                              {record.type === "show" ? (
                                <span className="bg-rose-950/40 text-rose-300 px-1.5 py-0.5 rounded border border-rose-900/50">TV</span>
                              ) : (
                                <span className="bg-slate-800/60 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700/50">Film</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-medium">{record.dateStr}</td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-200 block truncate max-w-sm" title={record.cleanTitle}>
                                {record.cleanTitle}
                              </span>
                              {record.isSupplemental && (
                                <span className="text-[9px] text-[#e50914] font-semibold uppercase tracking-wider block mt-0.5">
                                  Trailer / Supplemental Ad Clip
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-300">
                              {record.durationMin} min
                            </td>
                            <td className="py-3 px-4 hidden md:table-cell text-slate-400 capitalize max-w-[150px] truncate" title={record.device}>
                              {record.device}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredRecords.length > 100 && (
                  <p className="text-[10px] text-gray-500 font-mono text-center mt-4">
                    List limited to top 100 records for viewport load performance. Use Search filters to narrow results.
                  </p>
                )}

              </div>
            )}

            {/* TAB 5: DYNAMIC WATCHED POSTER GALLERY */}
            {activeTab === "posters" && (
              <MoviePosters 
                topShows={analytics.topShows} 
                topMovies={analytics.topMovies} 
                records={filteredRecords}
              />
            )}

          </main>
        </>
      )}

      {/* SOLID FOOTER PANELS */}
      <footer className="mt-auto px-6 py-4 bg-[#141414] border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
        <div className="flex gap-6">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Data Cleaned Automatically</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Beginner Ready System</span>
        </div>
        <div className="text-[10px] text-slate-600 font-mono">
          V1.0.4 • SYSTEM STABLE • ID: FLX-9421
        </div>
      </footer>

    </div>
  );
}
