import { nightLabel } from "./dates";

/**
 * An event's start and end, as two labelled facts rather than one string.
 *
 * "SAT 4 APR · 09:00 · TO SUN 5 APR" made a reader work out which half of it
 * was the finish, and a run-on line cannot say "ends the next day" without
 * being read twice. Two labelled values cannot be misread.
 *
 * `ends` is null when there is genuinely nothing to add: no end time, and no
 * end date that differs from the start. An "ENDS —" would be worse than the
 * label simply not being there.
 */
export function eventWhen(event: {
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
}): { starts: string | null; ends: string | null } {
  const dayAndTime = (date: string, time: string | null) =>
    time ? `${nightLabel(date)} · ${time}` : nightLabel(date);

  const starts = event.startDate ? dayAndTime(event.startDate, event.startTime) : null;

  const spansDays = Boolean(
    event.endDate && event.startDate && event.endDate !== event.startDate,
  );

  if (spansDays) return { starts, ends: dayAndTime(event.endDate!, event.endTime) };

  // Same day: the end is only worth a line when there is a time on it, and it
  // repeats the date so that "start date with time, end date with time" reads
  // the same whether the event runs for an evening or for a weekend.
  if (event.endTime && event.startDate) {
    return { starts, ends: dayAndTime(event.startDate, event.endTime) };
  }

  return { starts, ends: null };
}
