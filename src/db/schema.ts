import { pgTable, serial, varchar, timestamp, integer, pgEnum, jsonb, text } from "drizzle-orm/pg-core";

export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'live', 'finished']);

export const matches = pgTable('matches', {
    id: serial('id').primaryKey(),
    sport: varchar('sport', { length: 255 }),
    homeTeam: varchar('home_team', { length: 255 }),
    awayTeam: varchar('away_team', { length: 255 }),
    status: matchStatusEnum('status').default('scheduled'),
    startTime: timestamp('start_time'),
    endTime: timestamp('end_time'),
    homeScore: integer('home_score').default(0),
    awayScore: integer('away_score').default(0),
    createdAt: timestamp('created_at').defaultNow()
});

export const commentary = pgTable('commentary', {
    id: serial('id').primaryKey(),
    matchId: integer('match_id').references(() => matches.id),
    minute: integer('minute'),
    sequence: integer('sequence'),
    period: varchar('period', { length: 50 }),
    eventType: varchar('event_type', { length: 50 }),
    actor: varchar('actor', { length: 255 }),
    team: varchar('team', { length: 255 }),
    message: text('message'),
    metadata: jsonb('metadata'),
    tags: text('tags').array(),
    createdAt: timestamp('created_at').defaultNow()
});
