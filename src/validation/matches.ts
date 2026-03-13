import { z } from "zod";

export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
} as const;

export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const isoDateString = z.iso.datetime();

export const createMatchSchema = z
  .object({
    sport: z.string().min(1, "sport must be a non-empty string"),
    homeTeam: z.string().min(1, "homeTeam must be a non-empty string"),
    awayTeam: z.string().min(1, "awayTeam must be a non-empty string"),
    startTime: isoDateString,
    endTime: isoDateString,
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime).getTime();
      const end = new Date(data.endTime).getTime();

      if (start >= end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endTime must be chronologically after startTime",
          path: ["endTime"],
        });
      }
    }
  });

export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});

export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];
