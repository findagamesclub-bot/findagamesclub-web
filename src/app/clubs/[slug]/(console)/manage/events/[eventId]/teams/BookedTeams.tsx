"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import type { BookedTeam } from "@/services/eventTeams.service";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * The teams people said they were playing for when they booked.
 *
 * The client's words: *"this team name is what should be shown in the club
 * owner event view under teams, where the club owner can then add player
 * names to that team."*
 *
 * So this is not a second list of teams. It is what the bookers typed, with
 * everybody who typed each one, and a press that opens the team editor with
 * the name and those players already filled in. 0168 had the club inventing
 * the teams from a roster, which is right for a club's own league and wrong
 * for an open tournament where six teams of four arrive already formed.
 *
 * A name the club has already made drops out: offering to build it a second
 * time is offering to do something that would be refused, because a player
 * cannot be in two teams at one event.
 */
export default function BookedTeams({ booked, busy, onBuild }: {
  booked: BookedTeam[];
  busy: boolean;
  onBuild: (team: BookedTeam) => void;
}) {
  const waiting = booked.filter((team) => !team.made);
  if (!booked.length) return null;

  return (
    <Stack spacing={1.25}
      sx={{ p: { xs: 1.75, sm: 2.25 }, borderRadius: 2,
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Stack spacing={0.2}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.08em", color: tokens.inkMuted }}>
          BOOKED UNDER A TEAM NAME
        </Typography>
        <Typography variant="caption"
          sx={{ fontFamily: display, color: tokens.inkMuted, maxWidth: "68ch" }}>
          {waiting.length
            ? "What people typed when they booked. Building one opens the team with these players already in it, and you can change them before saving."
            : "Every team name people booked under is already a team here."}
        </Typography>
      </Stack>

      <Stack spacing={0}>
        {booked.map((team) => (
          <Box key={team.name}
            sx={{ display: "grid", gap: 1, alignItems: "center",
                  gridTemplateColumns: { xs: "1fr auto", sm: "minmax(0, 1fr) minmax(0, 2fr) auto" },
                  py: 0.9, borderTop: `1px solid ${tokens.rule}`,
                  "&:first-of-type": { borderTop: 0 },
                  opacity: team.made ? 0.66 : 1 }}>
            <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "0.95rem" }}
              noWrap>
              {team.name}
            </Typography>
            <Typography variant="body2"
              sx={{ color: tokens.inkMuted, minWidth: 0,
                    gridColumn: { xs: "1 / -1", sm: "auto" },
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {team.players.map((player) => player.name).join(", ")}
            </Typography>
            <Box sx={{ justifySelf: "end" }}>
              {team.made ? (
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                  letterSpacing: "0.08em", color: tokens.positive,
                                  whiteSpace: "nowrap" }}>
                  ALREADY A TEAM
                </Typography>
              ) : (
                <Button size="small" variant="outlined" disabled={busy}
                  startIcon={<GroupAddIcon />}
                  onClick={() => onBuild(team)}
                  aria-label={`Build the team ${team.name} from the people who booked under it`}
                  sx={{ whiteSpace: "nowrap", borderColor: tokens.rule, color: tokens.ink }}>
                  Build it
                </Button>
              )}
            </Box>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
