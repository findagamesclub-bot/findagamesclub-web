import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt";
import StorefrontIcon from "@mui/icons-material/Storefront";
import SchoolIcon from "@mui/icons-material/School";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { sinceLabel } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { OwnerTask } from "@/services/ownerInbox.service";

const ICONS = {
  join: PersonAddIcon,
  order: StorefrontIcon,
  coaching: SchoolIcon,
} as const;

/**
 * One thing waiting on the owner.
 *
 * The name and what they want stack rather than running on one line, because
 * these sit in a card now and "booked Warhammer 40k coaching — not paid" does
 * not fit beside a name in 340px.
 */
export default function OwnerTaskRow({
  task, faction, first,
}: {
  task: OwnerTask;
  faction: Faction;
  first: boolean;
}) {
  const Icon = ICONS[task.kind];

  return (
    <NextLink href={task.href} style={{ textDecoration: "none", color: "inherit" }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          px: 2, py: 1.5, alignItems: "flex-start",
          borderTop: first ? "none" : `1px solid ${tokens.rule}`,
          transition: "background-color 140ms ease",
          "&:hover": { backgroundColor: faction.soft },
          "&:hover .task-chevron": { transform: "translateX(2px)", color: faction.base },
        }}
      >
        <Icon sx={{ fontSize: 18, color: faction.base, flexShrink: 0, mt: 0.3 }} />

        <Stack spacing={0.2} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-display)" }}>
            {task.personName}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {task.detail}
          </Typography>
        </Stack>

        <Stack spacing={0.4} sx={{ alignItems: "flex-end", flexShrink: 0 }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem",
                            letterSpacing: "0.06em", color: tokens.inkMuted }}>
            {(sinceLabel(task.at) ?? "").toUpperCase()}
          </Typography>
          <ChevronRightIcon className="task-chevron"
            sx={{ fontSize: 17, color: tokens.rule,
                  transition: "transform 140ms ease, color 140ms ease" }} />
        </Stack>
      </Stack>
    </NextLink>
  );
}
