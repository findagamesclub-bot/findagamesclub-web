import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono } from "@/lib/tokens";
import type { ClubEventSummary } from "@/types/clubDetail";

function formatDate(iso: string | null): string {
  if (!iso) return "Date TBC";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function ClubEventList({ events }: { events: ClubEventSummary[] }) {
  return (
    <Stack spacing={1.5}>
      {events.map((event) => (
        <Card key={event.id}>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                <Typography variant="h4">{event.title}</Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.85rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                  {formatDate(event.startDate)}{event.startTime ? ` · ${event.startTime}` : ""}
                </Typography>
              </Stack>

              {event.summary ? (
                <Typography variant="body2" color="text.secondary">{event.summary}</Typography>
              ) : null}

              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                {event.eventType ? <Chip size="small" variant="outlined" label={event.eventType} /> : null}
                {event.roundCount ? <Chip size="small" variant="outlined" label={`${event.roundCount} rounds`} /> : null}
                {event.price ? <Chip size="small" variant="outlined" label={event.price} /> : null}
                {event.ticketsAvailable != null ? (
                  <Chip size="small" variant="outlined"
                    label={event.ticketsAvailable > 0 ? `${event.ticketsAvailable} tickets left` : "Sold out"} />
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
