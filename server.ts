/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables (such as GEMINI_API_KEY)
dotenv.config();

// Helper to safely lazily initialize the Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not defined in Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to support JSON parsing
  app.use(express.json());

  // API router configuration
  const apiRouter = express.Router();

  // Test API endpoint
  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy to fetch high-quality movie/show poster dynamically using Wikipedia PageImages search with scoring
  apiRouter.get("/movie-poster", async (req, res) => {
    try {
      const queryTitle = req.query.q;
      const mediaType = req.query.t; // "show" or "movie"
      if (!queryTitle || typeof queryTitle !== "string") {
        return res.status(400).json({ error: "Missing title parameter q" });
      }

      const cleanQuery = queryTitle.replace(/[\"':]/g, "").trim();
      const mType = (mediaType === "show" || mediaType === "movie") ? mediaType : "show";

      let chosenPoster: string | null = null;
      let chosenTitle: string | null = null;
      let maxScore = -999;

      const runWikipediaSearch = async (terms: string) => {
        const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(terms)}&gsrlimit=12&prop=pageimages&piprop=thumbnail&pithumbsize=600&format=json&origin=*`;
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data: any = await response.json();
        const pages = data?.query?.pages;
        if (!pages) return null;

        let bestPage: any = null;
        let highestScore = -999;

        for (const pageId of Object.keys(pages)) {
          const page = pages[pageId];
          if (!page.thumbnail || !page.thumbnail.source) continue;

          // Compute custom intelligence score
          const pTitle = page.title;
          const pLower = pTitle.toLowerCase();
          const qLower = cleanQuery.toLowerCase();

          let score = 100; // Base score

          // Check for exact match of title
          if (pLower === qLower) {
            score += 200;
          }

          // Strip parentheses for base comparison e.g., "The Irishman (film)" -> "The Irishman"
          const pBase = pTitle.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
          const qBase = cleanQuery.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();

          if (pBase === qBase) {
            score += 150;
          } else if (pBase.includes(qBase) || qBase.includes(pBase)) {
            score += 60;
          }

          // Search index penalty (prefer earlier search results from wikipedia)
          if (typeof page.index === "number") {
            score -= page.index * 10;
          }

          // Handle Netflix context
          if (pLower.includes("netflix") || terms.toLowerCase().includes("netflix")) {
            score += 25;
          }

          // Media type alignment
          if (mType === "show") {
            if (pLower.includes("series") || pLower.includes("tv") || pLower.includes("television") || pLower.includes("show")) {
              score += 80;
            }
            if (pLower.includes("season")) {
              score -= 30; // Prefer the main show landing page
            }
            if (pLower.includes("film") || pLower.includes("movie")) {
              score -= 50;
            }
          } else if (mType === "movie") {
            if (pLower.includes("film") || pLower.includes("movie")) {
              score += 80;
            }
            if (pLower.includes("series") || pLower.includes("tv") || pLower.includes("television") || pLower.includes("episode") || pLower.includes("season")) {
              score -= 65;
            }
          }

          // Strict Filter/Penalty for non-media titles
          if (
            pLower.includes("disambiguation") ||
            pLower.includes("soundtrack") ||
            pLower.includes("discography") ||
            pLower.includes("list of") ||
            pLower.includes("episodes") ||
            pLower.includes("characters") ||
            pLower.includes("cast of") ||
            pLower.includes("production of") ||
            pLower.includes("video game") ||
            pLower.includes("album")
          ) {
            score -= 300;
          }

          if (score > highestScore) {
            highestScore = score;
            bestPage = page;
          }
        }

        return { page: bestPage, score: highestScore };
      };

      // Round 1: Search with Netflix context to tally with Netflix precisely
      const round1 = await runWikipediaSearch(`${cleanQuery} netflix`);
      if (round1 && round1.page && round1.score > 80) {
        chosenPoster = round1.page.thumbnail.source;
        chosenTitle = round1.page.title;
        maxScore = round1.score;
      }

      // Round 2 (Fallback if Round 1 failed or score is low): Standard precise search
      if (!chosenPoster || maxScore < 150) {
        const round2 = await runWikipediaSearch(cleanQuery);
        if (round2 && round2.page && round2.score > maxScore) {
          chosenPoster = round2.page.thumbnail.source;
          chosenTitle = round2.page.title;
          maxScore = round2.score;
        }
      }

      // Round 3 (Super-broad fallback if still nothing found): Search with media suffix
      if (!chosenPoster) {
        const round3Suffix = mType === "show" ? "TV series" : "film";
        const round3 = await runWikipediaSearch(`${cleanQuery} ${round3Suffix}`);
        if (round3 && round3.page) {
          chosenPoster = round3.page.thumbnail.source;
          chosenTitle = round3.page.title;
        }
      }

      if (chosenPoster) {
        return res.json({ 
          posterUrl: chosenPoster, 
          title: queryTitle, 
          wikiTitle: chosenTitle,
          score: maxScore,
          source: "wikipedia_intelligent_scoring" 
        });
      }

      return res.json({ posterUrl: null, title: queryTitle });
    } catch (err: any) {
      console.error("Poster proxy failure:", err);
      return res.status(500).json({ error: "Failed to resolve poster image", details: err?.message });
    }
  });

  // AI analysis proxy API using the Gemini API
  apiRouter.post("/analyze-habits", async (req, res) => {
    try {
      const { topShows, topMovies, summary } = req.body;

      if (!topShows || !topMovies) {
        return res.status(400).json({ error: "Missing required profile list parameters." });
      }

      // Safeguard: Extract only top 15 shows and top 15 movies to keep prompts lightweight and optimal
      const showsSubset = topShows.slice(0, 15).map((s: any) => `${s.name} (${s.count} episodes, approx ${s.durationMin} mins)`);
      const moviesSubset = topMovies.slice(0, 15).map((m: any) => `${m.name} (${m.count} views, approx ${m.durationMin} mins)`);

      const totalWatchTimeHr = summary ? Math.round(summary.totalWatchTimeMin / 60) : 0;
      const totalTitles = summary ? summary.totalRecords : 0;

      // Constructing our structured prompt
      const prompt = `You are a professional, entertaining, and highly knowledgeable Netflix data analyst and movie expert.
Analyze the user's Netflix viewing history metrics and top watched shows/movies list, and generate a personal dashboard report.

--- USER STATISTICS ---
- Total Titles Watched: ${totalTitles}
- Total Watch Time: ${totalWatchTimeHr} hours
- Most Watched TV Shows list (top 15):
${showsSubset.join("\n")}

- Most Watched Movies list (top 15):
${moviesSubset.join("\n")}

--- INSTRUCTIONS ---
Based on this raw Netflix data:
1. Deduce their specific Netflix "Viewing Personality Title" (e.g. "The Late-Night Suspense Seeker", "The Comfort-Watcher", "Classic Cinephile").
2. Provide a funny and witty human-centered "Personality Description" describing this specific watching behavior.
3. Highlight 3 key observations or "Key Insights" about their density or pace of consumption. Avoid generic statements, try to draw thematic connections between shows (e.g. "You seem to love deep psychological plot twists since Stranger Things is your #1 show").
4. Deduce their favorite 4 Genres ("inferredGenres") based on the lists. Netflix history does not store genres directly, so use your database of shows/movies to map these titles to their true genres (e.g. Comedy, Anime, Drama, Sci-Fi) with estimated percentage weights (must sum to roughly 100%) and a concise explanation.
5. List 4 "Recommendations" of currently available movies or series on Netflix that they would absolutely love, specifying the type ('show' or 'movie'), a fit score percentage (e.g. 95), and a convincing custom reason of why this matches their specific favorites.

Output your response ENTIRELY as valid JSON matching the following structure exactly (do not output markdown fences or backticks inside of the JSON itself):
{
  "personalityTitle": "string",
  "personalityDescription": "string",
  "keyInsights": ["string"],
  "inferredGenres": [
    { "genre": "string", "percentage": number, "explanation": "string" }
  ],
  "recommendations": [
    { "title": "string", "type": "show" | "movie", "reason": "string", "fitScore": number }
  ]
}`;

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          // Use responseSchema to enforce valid output format
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              personalityTitle: { type: Type.STRING, description: "A witty, descriptive title for the watcher's personality class" },
              personalityDescription: { type: Type.STRING, description: "Detailed witty description of the viewing profile style" },
              keyInsights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 3 unique custom observations and facts extracted from data"
              },
              inferredGenres: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    genre: { type: Type.STRING },
                    percentage: { type: Type.NUMBER },
                    explanation: { type: Type.STRING }
                  },
                  required: ["genre", "percentage", "explanation"]
                },
                description: "Predicted genre distributions compiled based on actual titles list"
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, description: "Must be 'show' or 'movie'" },
                    reason: { type: Type.STRING },
                    fitScore: { type: Type.NUMBER }
                  },
                  required: ["title", "type", "reason", "fitScore"]
                },
                description: "Recommended customized movies/shows available on Netflix based on stats"
              }
            },
            required: ["personalityTitle", "personalityDescription", "keyInsights", "inferredGenres", "recommendations"]
          }
        },
      });

      const responseText = response.text || "{}";
      const parsedInsights = JSON.parse(responseText.trim());
      return res.json(parsedInsights);
    } catch (error: any) {
      console.error("Gemini API Error in backend:", error);
      return res.status(500).json({
        error: "Failed to generate AI insights.",
        details: error?.message || String(error)
      });
    }
  });

  // Mount API router
  app.use("/api", apiRouter);

  // Vite middleware for dev or Static File Serving for prod
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static assets serving...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Backend + Vite dev server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server failure on startup:", err);
});
