/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ViewingRecord } from "../types";

/**
 * Parses CSV lines correctly taking into account quoted strings that contain commas.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Check for escaped double quotes
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Guesses if a title represents a television show episode or a movie.
 * Typically TV show episodes on Netflix have structures like:
 * "Show Name: Season X: Episode Title" or "Show Name: Part X: Episode Title"
 */
export function analyzeTitle(rawTitle: string): {
  type: "show" | "movie";
  seriesName: string;
  seasonName: string | null;
  episodeName: string | null;
} {
  // Use colons to split the segments
  const segments = rawTitle.split(":").map((s) => s.trim());

  if (segments.length >= 3) {
    // Highly likely to be a TV Show: "Stranger Things: Season 1: Chapter 1"
    const seriesName = segments[0];
    
    // Check if the second segment is a known season/part keyword
    const isSeasonPattern = /season|series|part|volume|chapter|book|collection|limited/i.test(segments[1]);
    
    if (isSeasonPattern) {
      const seasonName = segments[1];
      const episodeName = segments.slice(2).join(": ");
      return { type: "show", seriesName, seasonName, episodeName };
    } else {
      // Fallback if there are multiple colons but second segment isn't explicitly "Season X"
      // e.g., "The Office (U.S.): Season 4: Money (Part 1)"
      const seasonName = segments[1];
      const episodeName = segments.slice(2).join(": ");
      return { type: "show", seriesName, seasonName, episodeName };
    }
  } else if (segments.length === 2) {
    // E.g. "Bridgerton: Season 1" or "Movie Title: Subtitle"
    const isSeasonPattern = /season|series|part|volume|chapter|book|collection|limited|episode/i.test(segments[1]);
    if (isSeasonPattern) {
      return {
        type: "show",
        seriesName: segments[0],
        seasonName: segments[1],
        episodeName: segments[1]
      };
    } else {
      // Treat as movie with subtitle
      return {
        type: "movie",
        seriesName: rawTitle,
        seasonName: null,
        episodeName: null
      };
    }
  }

  // Single segment title -> Movie
  return {
    type: "movie",
    seriesName: rawTitle,
    seasonName: null,
    episodeName: null
  };
}

/**
 * Parses Duration segment formatted as HH:MM:SS into minutes.
 */
export function parseDurationToMinutes(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(":").map(Number);
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 60 + minutes + seconds / 60;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes + seconds / 60;
  }
  return Number(durationStr) || 0;
}

/**
 * Main parser function to clean and load viewing history from Netflix exports.
 */
export function parseNetflixCSV(csvContent: string): ViewingRecord[] {
  // Normalize line endings
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, "").trim());

  // Detect format
  // Format 1: Simple history ("Title", "Date")
  // Format 2: Detailed history ("Profile Name", "Start Time", "Duration", "Attributes", "Title", "Supplemental Video Type", ...)
  const isDetailed = headers.includes("Profile Name") && headers.includes("Start Time") && headers.includes("Duration");

  const records: ViewingRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.length < 2) continue; // Skip malformed rows

    let rawTitle = "";
    let dateStr = "";
    let durationMin = 40; // Default estimate
    let profile = "Default";
    let device = "Unknown";
    let startTime: string | null = null;
    let isSupplemental = false;

    if (isDetailed) {
      // Index of items in standard Netflix detailed report
      const pIdx = headers.indexOf("Profile Name");
      const sIdx = headers.indexOf("Start Time");
      const dIdx = headers.indexOf("Duration");
      const tIdx = headers.indexOf("Title");
      const supIdx = headers.indexOf("Supplemental Video Type");
      const devIdx = headers.indexOf("Device Type");

      profile = cells[pIdx] || "Default";
      startTime = cells[sIdx] || null;
      const durationStr = cells[dIdx] || "00:00:00";
      durationMin = parseDurationToMinutes(durationStr);
      rawTitle = cells[tIdx] || "";
      device = cells[devIdx] || "Unknown";

      const supType = cells[supIdx] || "";
      // Previews, trailer, hook, clips don't count as standard full title views
      isSupplemental = supType.trim().length > 0;
      
      // Parse detailed start time (e.g., "2024-03-10 14:30:22") to extract pure date
      if (startTime) {
        const datePart = startTime.split(" ")[0]; // YYYY-MM-DD
        dateStr = datePart;
      }
    } else {
      // Simple format (usually columns 0 is Title, 1 is Date)
      const tIdx = headers.indexOf("Title") !== -1 ? headers.indexOf("Title") : 0;
      const dIdx = headers.indexOf("Date") !== -1 ? headers.indexOf("Date") : 1;

      rawTitle = cells[tIdx] || "";
      const rawDate = cells[dIdx] || "";

      // Standard Simple history format date can be M/D/YY or DD/MM/YYYY or YYYY-MM-DD
      // We will parse it and convert it to YYYY-MM-DD for standard format
      try {
        const parsedDate = new Date(rawDate);
        if (!isNaN(parsedDate.getTime())) {
          const year = parsedDate.getFullYear();
          const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
          const day = String(parsedDate.getDate()).padStart(2, "0");
          dateStr = `${year}-${month}-${day}`;
        } else {
          dateStr = rawDate;
        }
      } catch (e) {
        dateStr = rawDate;
      }

      // Check for trailers/previews using common title indicators for simple format
      isSupplemental = /trailer|teaser|recap|preview|bonus|clip/i.test(rawTitle);
    }

    if (!rawTitle) continue;

    // Clean title - remove leading/trailing quotes if exist
    const cleanTitle = rawTitle.replace(/^["']|["']$/g, "").trim();

    // Analyze title parts
    const titleAnalysis = analyzeTitle(cleanTitle);

    // If simple history, adjust duration based on type
    if (!isDetailed) {
      // Standard movie = 100 mins, standard TV episode = 40 mins
      durationMin = titleAnalysis.type === "movie" ? 100 : 40;
    }

    // Attempt to build Date object
    let dateObjObj = new Date(dateStr);
    if (isNaN(dateObjObj.getTime())) {
      dateObjObj = new Date();
    }

    records.push({
      id: `${i}-${cleanTitle.slice(0, 10)}`,
      rawTitle: cleanTitle,
      cleanTitle,
      dateStr,
      date: dateObjObj,
      type: titleAnalysis.type,
      seriesName: titleAnalysis.seriesName,
      seasonName: titleAnalysis.seasonName,
      episodeName: titleAnalysis.episodeName,
      durationMin: Math.round(durationMin * 10) / 10,
      startTime,
      device,
      profile,
      isSupplemental
    });
  }

  // Sort chronologically ascending
  return records.sort((a, b) => a.date.getTime() - b.date.getTime());
}
