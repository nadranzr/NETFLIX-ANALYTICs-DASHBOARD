/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ViewingRecord {
  id: string;
  rawTitle: string;
  cleanTitle: string;
  dateStr: string; // YYYY-MM-DD format
  date: Date;
  type: "show" | "movie";
  seriesName: string; // "Stranger Things" for show, or the movie name
  seasonName: string | null; // "Season 1" etc
  episodeName: string | null; // "Chapter One: ..."
  durationMin: number; // Duration in minutes
  startTime: string | null; // ISO / datetime string if available
  device: string; // Device watcher used, defaults to "Unknown"
  profile: string; // Profile name, defaults to "Default"
  isSupplemental: boolean; // Previews, trailers, hooks
}

export interface AnalyticsSummary {
  totalRecords: number;
  totalWatchTimeMin: number;
  totalUniqueShows: number;
  totalUniqueMovies: number;
  mostWatchedShow: { name: string; count: number; durationMin: number } | null;
  mostWatchedMovie: { name: string; count: number; durationMin: number } | null;
  longestStreakDays: number;
  longestStreakDates: { start: string; end: string } | null;
}

export interface TopItem {
  name: string;
  count: number;
  durationMin: number;
}

export interface GenericTrendItem {
  label: string; // "Monday", "Jan", "2024", etc.
  count: number;
  durationMin: number;
}

export interface HeatmapItem {
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  hour: number; // 0 - 23
  count: number;
  durationMin: number;
}

export interface BingeSession {
  dateStr: string;
  seriesName: string;
  episodeCount: number;
  durationMin: number;
  episodes: string[];
}

export interface AIInsightResponse {
  personalityTitle: string;
  personalityDescription: string;
  keyInsights: string[];
  inferredGenres: { genre: string; percentage: number; explanation: string }[];
  recommendations: { title: string; type: "show" | "movie"; reason: string; fitScore: number }[];
}
