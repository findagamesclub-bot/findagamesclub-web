import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PaymentsIcon from "@mui/icons-material/Payments";
import type { SvgIconComponent } from "@mui/icons-material";
import { display, mono, tokens } from "@/lib/tokens";
import type { ConsoleTask } from "@/services/console.service";

const ICONS: Record<ConsoleTask["kind"], SvgIconComponent> = {
  join: PersonAddIcon,
  score: ScoreboardIcon,
  order: StorefrontIcon,
  renewal: PaymentsIcon,
};

/**
 * What is waiting, as rows you can walk down.
 *
 * The figure leads because that is the thing being scanned. Brass on it,
 * because a count of things waiting is data worth emphasis, and the row is the
 * link rather than carrying a button: the whole row is one destination.
 */
export default function TaskList({ tasks }: { tasks: ConsoleTask[] }) {
  return (
    <Stack spacing={1}>
      {tasks.map((task) => {
        const Icon = ICONS[task.kind];
        return (
          <NextLink key={task.kind} href={task.href}
            style={{ textDecoration: "none", color: "inherit" }}>
            <Stack direction="row" spacing={1.5}
              sx={{ alignItems: "center", px: 2, py: 1.5, borderRadius: 1.5,
                    border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                    "&:hover": { borderColor: tokens.brass } }}>
              <Icon sx={{ fontSize: 19, color: tokens.brass, flexShrink: 0 }} />
              <Typography sx={{ fontFamily: mono, fontSize: "1.25rem", fontWeight: 700,
                                lineHeight: 1, color: tokens.brass,
                                fontVariantNumeric: "tabular-nums" }}>
                {task.count}
              </Typography>
              <Typography sx={{ flex: 1, minWidth: 0, fontFamily: display,
                                fontSize: "0.95rem", fontWeight: 500 }}>
                {task.label}
              </Typography>
              <ChevronRightIcon sx={{ fontSize: 20, color: tokens.inkMuted, flexShrink: 0 }} />
            </Stack>
          </NextLink>
        );
      })}
      {tasks.length === 0 ? (
        <Box sx={{ px: 2, py: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                   backgroundColor: tokens.paper }}>
          <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 600 }}>
            Nothing is waiting on you
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.5 }}>
            Join requests, scores to rule on and orders to answer appear here.
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
}
