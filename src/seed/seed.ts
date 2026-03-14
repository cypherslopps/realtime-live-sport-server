import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { createMatchSchema } from "../validation/matches";
import { createCommentarySchema } from "../validation/commentary";
import { Matches } from "../db/schema";

// ─── Config ──────────────────────────────────────────────────────────────────

const DELAY_MS = Number.parseInt(process.env.DELAY_MS || "250", 10);
const NEW_MATCH_DELAY_MIN_MS = 2000;
const NEW_MATCH_DELAY_MAX_MS = 3000;
const DEFAULT_MATCH_DURATION_MINUTES = Number.parseInt(
  process.env.SEED_MATCH_DURATION_MINUTES || "120",
  10
);
const FORCE_LIVE =
  process.env.SEED_FORCE_LIVE !== "0" &&
  process.env.SEED_FORCE_LIVE !== "false";
const API_URL = process.env.API_URL;

if (!API_URL) {
  throw new Error("API_URL is required to seed via REST endpoints.");
}

const DEFAULT_DATA_FILE =
  process.env.SEED_DATA_FILE ||
  path.resolve(process.cwd(), "src/data/data.json");

// ─── Types ────────────────────────────────────────────────────────────────────

type CreateMatch = z.infer<typeof createMatchSchema>;
type CreateCommentary = z.infer<typeof createCommentarySchema>;

type SeedMatch = Partial<CreateMatch> & {
  id?: number;
  sport: string;
  homeTeam: string;
  awayTeam: string;
};

type SeedCommentary = Partial<CreateCommentary> & {
  matchId?: number;
};

type MatchState = {
  match: Matches;
  score: { home: number; away: number };
};

// ─── File Loading ─────────────────────────────────────────────────────────────

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function loadSeedData(): Promise<{
  feed: SeedCommentary[];
  matches: SeedMatch[];
}> {
  const raw = await readJsonFile(DEFAULT_DATA_FILE);

  if (typeof raw !== "object" || raw === null) {
    throw new Error("Seed data must be an object or array.");
  }

  if (Array.isArray(raw)) {
    return { feed: raw as SeedCommentary[], matches: [] };
  }

  const parsed = raw as Record<string, unknown>;
  const commentary = parsed["commentary"];
  const feed = parsed["feed"];
  const matches = parsed["matches"];
  const matchesArray = Array.isArray(matches) ? (matches as SeedMatch[]) : [];

  if (Array.isArray(commentary)) {
    return { feed: commentary as SeedCommentary[], matches: matchesArray };
  }

  if (Array.isArray(feed)) {
    return { feed: feed as SeedCommentary[], matches: matchesArray };
  }

  throw new Error(
    "Seed data must be an array or contain a commentary/feed array."
  );
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function fetchMatches(limit = 100): Promise<Matches[]> {
  console.log(
    `📡 Fetching existing matches from API: ${API_URL}/matches?limit=${limit}`
  );
  const response = await fetch(`${API_URL}/matches?limit=${limit}`);
  if (!response.ok)
    throw new Error(`Failed to fetch matches: ${response.status}`);
  const payload = (await response.json()) as { data: unknown };
  return Array.isArray(payload.data) ? (payload.data as Matches[]) : [];
}

async function createMatch(body: CreateMatch): Promise<Matches> {
  const response = await fetch(`${API_URL}/matches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`Failed to create match: ${response.status}`);
  const payload = (await response.json()) as { data: Matches };
  return payload.data;
}

async function insertCommentary(
  matchId: number,
  entry: SeedCommentary
): Promise<CreateCommentary & { id: number }> {
  const payload: CreateCommentary = {
    message: entry.message ?? "Update",
    minute: entry.minute ?? 0,
    sequence: entry.sequence ?? 0,
    period: entry.period ?? "first",
    eventType: entry.eventType ?? "update",
    actor: entry.actor ?? "unknown",
    team: entry.team ?? "unknown",
    tags: entry.tags ?? [],
    ...(entry.metadata !== undefined && { metadata: entry.metadata }),
  };

  const response = await fetch(`${API_URL}/matches/${matchId}/commentary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok)
    throw new Error(`Failed to create commentary: ${response.status}`);
  const responsePayload = (await response.json()) as {
    data: CreateCommentary & { id: number };
  };
  return responsePayload.data;
}

// ─── Match Time Helpers ───────────────────────────────────────────────────────

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isLiveMatch(match: Matches): boolean {
  const start = parseDate(match.startTime.toISOString());
  const end = match.endTime ? parseDate(match.endTime.toISOString()) : null;
  if (!start || !end) return false;
  const now = new Date();
  return now >= start && now < end;
}

function buildMatchTimes(
  seedMatch: SeedMatch
): Pick<CreateMatch, "startTime" | "endTime"> {
  const now = new Date();
  const durationMs = DEFAULT_MATCH_DURATION_MINUTES * 60 * 1000;

  let start = parseDate(seedMatch.startTime ?? null);
  let end = parseDate(seedMatch.endTime ?? null);

  if (!start && !end) {
    start = new Date(now.getTime() - 5 * 60 * 1000);
    end = new Date(start.getTime() + durationMs);
  } else {
    if (start && !end) end = new Date(start.getTime() + durationMs);
    if (!start && end) start = new Date(end.getTime() - durationMs);
  }

  if (FORCE_LIVE && start && end && !(now >= start && now < end)) {
    start = new Date(now.getTime() - 5 * 60 * 1000);
    end = new Date(start.getTime() + durationMs);
  }

  if (!start || !end) {
    throw new Error("Seed match must include valid startTime and endTime.");
  }

  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

function randomMatchDelay(): number {
  const range = NEW_MATCH_DELAY_MAX_MS - NEW_MATCH_DELAY_MIN_MS;
  return NEW_MATCH_DELAY_MIN_MS + Math.floor(Math.random() * (range + 1));
}

// ─── Cricket Feed Normalization ───────────────────────────────────────────────

function inningsRank(period: string | undefined | null): number {
  if (!period) return 0;
  const lower = String(period).toLowerCase();
  const match = lower.match(/(\d+)(st|nd|rd|th)/);
  if (match) return Number(match[1]) || 0;
  if (lower.includes("first")) return 1;
  if (lower.includes("second")) return 2;
  if (lower.includes("third")) return 3;
  if (lower.includes("fourth")) return 4;
  return 0;
}

function normalizeCricketFeed(
  entries: SeedCommentary[],
  match: Matches
): SeedCommentary[] {
  const sorted = [...entries].sort((a, b) => {
    const inningsDiff = inningsRank(a.period) - inningsRank(b.period);
    if (inningsDiff !== 0) return inningsDiff;
    const seqA = Number.isFinite(a.sequence)
      ? a.sequence!
      : Number.MAX_SAFE_INTEGER;
    const seqB = Number.isFinite(b.sequence)
      ? b.sequence!
      : Number.MAX_SAFE_INTEGER;
    if (seqA !== seqB) return seqA - seqB;
    const minA = Number.isFinite(a.minute)
      ? a.minute!
      : Number.MAX_SAFE_INTEGER;
    const minB = Number.isFinite(b.minute)
      ? b.minute!
      : Number.MAX_SAFE_INTEGER;
    return minA - minB;
  });

  const grouped = new Map<number, SeedCommentary[]>();
  for (const entry of sorted) {
    const key = inningsRank(entry.period);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(entry);
  }

  const ordered: SeedCommentary[] = [];

  for (const key of Array.from(grouped.keys()).sort((a, b) => a - b)) {
    const inningsEntries = grouped.get(key) ?? [];
    const primaryTeam = inningsEntries.find(
      (e) => e.team === match.homeTeam || e.team === match.awayTeam
    )?.team;
    const secondaryTeam =
      primaryTeam === match.homeTeam ? match.awayTeam : match.homeTeam;

    ordered.push(
      ...inningsEntries.filter((e) => !e.team || e.team === "neutral"),
      ...inningsEntries.filter((e) => e.team === primaryTeam),
      ...inningsEntries.filter((e) => e.team === secondaryTeam),
      ...inningsEntries.filter(
        (e) =>
          e.team &&
          e.team !== "neutral" &&
          e.team !== primaryTeam &&
          e.team !== secondaryTeam
      )
    );
  }

  return ordered;
}

// ─── Feed Expansion & Cloning ─────────────────────────────────────────────────

function replaceTrailingTeam(
  message: string,
  replacements: Map<string, string>
): string {
  const match = message.match(/\(([^)]+)\)\s*$/);
  if (!match?.[1]) return message;
  const next = replacements.get(match[1]);
  if (!next) return message;
  return message.replace(/\([^)]+\)\s*$/, `(${next})`);
}

function cloneCommentaryEntries(
  entries: SeedCommentary[],
  templateMatch: Matches,
  targetMatch: Matches
): SeedCommentary[] {
  const replacements = new Map<string, string>([
    [templateMatch.homeTeam, targetMatch.homeTeam],
    [templateMatch.awayTeam, targetMatch.awayTeam],
  ]);

  return entries.map((entry) => {
    const team =
      entry.team === templateMatch.homeTeam
        ? targetMatch.homeTeam
        : entry.team === templateMatch.awayTeam
          ? targetMatch.awayTeam
          : entry.team;

    // Only include 'team' if it's defined, to satisfy exactOptionalPropertyTypes
    const result: SeedCommentary = {
      ...entry,
      matchId: targetMatch.id,
      message: entry.message
        ? replaceTrailingTeam(entry.message, replacements)
        : "",
    };
    if (team !== undefined) {
      result.team = team;
    }
    return result;
  });
}

function expandFeedForMatches(
  feed: SeedCommentary[],
  seedMatches: SeedMatch[]
): SeedCommentary[] {
  if (!seedMatches.length) return feed;

  const byMatchId = new Map<number, SeedCommentary[]>();
  for (const entry of feed) {
    if (!Number.isInteger(entry.matchId)) continue;
    const id = entry.matchId!;
    if (!byMatchId.has(id)) byMatchId.set(id, []);
    byMatchId.get(id)!.push(entry);
  }

  const templateBySport = new Map<string, SeedMatch>();
  for (const match of seedMatches) {
    if (!templateBySport.has(match.sport) && byMatchId.has(match.id!)) {
      templateBySport.set(match.sport, match);
    }
  }

  const expanded = [...feed];
  for (const match of seedMatches) {
    if (byMatchId.has(match.id!)) continue;
    const template = templateBySport.get(match.sport);
    if (!template) continue;
    expanded.push(
      ...cloneCommentaryEntries(
        byMatchId.get(template.id!) ?? [],
        template as unknown as Matches,
        match as unknown as Matches
      )
    );
  }

  return expanded;
}

function buildRandomizedFeed(
  feed: SeedCommentary[],
  matchMap: Map<number, MatchState>
): SeedCommentary[] {
  const buckets = new Map<number, SeedCommentary[]>();

  for (const entry of feed) {
    if (!Number.isInteger(entry.matchId)) continue;
    const id = entry.matchId!;
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id)!.push(entry);
  }

  for (const [matchId, entries] of buckets) {
    const state = matchMap.get(matchId);
    if (state?.match.sport?.toLowerCase() === "cricket") {
      buckets.set(matchId, normalizeCricketFeed(entries, state.match));
    }
  }

  const matchIds = Array.from(buckets.keys());
  const randomized: SeedCommentary[] = [];
  let lastMatchId: number | null = null;

  while (randomized.length < feed.length) {
    const candidates = matchIds.filter(
      (id) => (buckets.get(id) ?? []).length > 0
    );
    if (!candidates.length) break;

    const selectable: number[] =
      lastMatchId !== null && candidates.length > 1
        ? candidates.filter((id) => id !== lastMatchId)
        : candidates;

    const choice = selectable[Math.floor(Math.random() * selectable.length)]!;
    randomized.push(buckets.get(choice)!.shift()!);
    lastMatchId = choice;
  }

  return randomized;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`📡 Seeding via API: ${API_URL}`);

  const { feed, matches: seedMatches } = await loadSeedData();
  const matchesList = await fetchMatches();

  const matchMap = new Map<number, MatchState>();
  const matchKeyMap = new Map<string, Matches>();

  for (const match of matchesList) {
    if (FORCE_LIVE && !isLiveMatch(match)) continue;
    const key = `${match.sport}|${match.homeTeam}|${match.awayTeam}`;
    if (!matchKeyMap.has(key)) matchKeyMap.set(key, match);
    matchMap.set(match.id, {
      match,
      score: { home: match.homeScore, away: match.awayScore },
    });
  }

  for (const seedMatch of seedMatches) {
    const key = `${seedMatch.sport}|${seedMatch.homeTeam}|${seedMatch.awayTeam}`;
    let match = matchKeyMap.get(key);

    if (!match || (FORCE_LIVE && !isLiveMatch(match))) {
      const { startTime, endTime } = buildMatchTimes(seedMatch);
      match = await createMatch({
        sport: seedMatch.sport,
        homeTeam: seedMatch.homeTeam,
        awayTeam: seedMatch.awayTeam,
        startTime,
        endTime,
        homeScore: seedMatch.homeScore ?? 0,
        awayScore: seedMatch.awayScore ?? 0,
      });
      matchKeyMap.set(key, match);
      await new Promise((resolve) => setTimeout(resolve, randomMatchDelay()));
    }

    const state: MatchState = {
      match,
      score: { home: match.homeScore, away: match.awayScore },
    };

    if (Number.isInteger(seedMatch.id)) matchMap.set(seedMatch.id!, state);
    matchMap.set(match.id, state);
  }

  if (matchMap.size === 0) {
    throw new Error("No matches found or created in the database.");
  }

  const expandedFeed = expandFeedForMatches(feed, seedMatches);
  const randomizedFeed = buildRandomizedFeed(expandedFeed, matchMap);

  for (const entry of randomizedFeed) {
    if (!Number.isInteger(entry.matchId)) {
      console.warn(
        "⚠️  Skipping entry: matchId missing or not found:",
        entry.message
      );
      continue;
    }

    const state = matchMap.get(entry.matchId!);
    if (!state) {
      console.warn(
        "⚠️  Skipping entry: match not found for id:",
        entry.matchId
      );
      continue;
    }

    const row = await insertCommentary(state.match.id, entry);
    console.log(`📣 [Match ${state.match.id}] ${row.message}`);

    if (DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }
}

seed().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
