import { MATCH_STATUS, MatchStatus } from "../validation/matches";

export function getMatchStatus(
  startTime: string | Date,
  endTime: string | Date,
  now: Date = new Date()
): MatchStatus | null {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (now < start) {
    return MATCH_STATUS.SCHEDULED;
  }

  if (now >= end) {
    return MATCH_STATUS.FINISHED;
  }

  return MATCH_STATUS.LIVE;
}

export type MatchData = {
  startTime: string | Date;
  endTime: string | Date;
  status: MatchStatus | null;
};

export async function syncMatchStatus<T extends MatchData>(
  match: T,
  updateStatus: (status: MatchStatus) => Promise<void>
): Promise<MatchStatus | null> {
  const nextStatus = getMatchStatus(match.startTime, match.endTime);
  if (!nextStatus) {
    return match.status;
  }
  if (match.status !== nextStatus) {
    await updateStatus(nextStatus);
    match.status = nextStatus;
  }
  return match.status;
}
