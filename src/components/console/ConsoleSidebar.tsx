"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SideNav from "@/components/ui/SideNav";
import { consoleGroups, type ConsoleCounts } from "./console-nav";
import { clubAccess, ROLE_LABEL, type ClubRole } from "@/utils/club-access";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * The club console's navigation.
 *
 * Icons are functions, so the groups cannot be handed across the server
 * boundary. This builds them here from the plain data the layout passes in.
 */
export default function ConsoleSidebar({
  slug, name, monogram, colour, role, counts,
}: {
  slug: string;
  name: string;
  monogram: string;
  /** The club's faction colour. It identifies the club, it does not decorate. */
  colour: string;
  role: ClubRole;
  counts: ConsoleCounts;
}) {
  const access = clubAccess(role);

  return (
    <SideNav
      groups={consoleGroups(slug, access, counts)}
      heading={name}
      fallbackLabel="Manage club"
      aside={
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", px: 1.5 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1, flexShrink: 0,
                     display: "grid", placeItems: "center",
                     backgroundColor: colour, color: "#fff" }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", fontWeight: 700 }}>
              {monogram}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700,
                              lineHeight: 1.25, overflowWrap: "anywhere" }}>
              {name}
            </Typography>
            <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              {(role ? ROLE_LABEL[role] : "").toUpperCase()}
            </Typography>
          </Box>
        </Stack>
      }
    />
  );
}
