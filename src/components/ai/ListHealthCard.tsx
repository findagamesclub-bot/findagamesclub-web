"use client";

import { useState } from "react";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { Notes, Good } from "./AiCards";
import type { ListHealth } from "@/utils/list-health";
import { mono, tokens } from "@/lib/tokens";

/**
 * What is wrong with the list, worked out here rather than asked for.
 *
 * This is the coach's evidence and it runs whether or not the model does, so
 * a list still gets a real review when the provider is down, the club is over
 * its budget, or AI is switched off on the deployment. Legacy only ever sends
 * these signals away; showing them is stage 11's one departure on its own
 * merits.
 *
 * Tabbed, because stacked it was a long scroll and the last section fell off
 * the end of it: the client could not find "working in your favour" at all,
 * which is the section somebody most wants after being told four things are
 * wrong. Three tabs of the same card, each carrying its own count, so the
 * balance between them is visible before anything is read.
 */
export default function ListHealthCard({ health }: { health: ListHealth }) {
  const [tab, setTab] = useState<"flagged" | "roles" | "good">("flagged");
  const { summary, healthSummary } = health;

  const counts = {
    flagged: health.flaggedIssues.length,
    roles: health.roleBalance.length,
    good: health.strengths.length,
  };

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1.5}
          sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
          <Typography sx={{ fontWeight: 700, fontSize: "1.15rem" }}>
            {healthSummary.label}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                            color: tokens.inkMuted }}>
            {[`${summary.uniqueUnits} lines`,
              `${summary.unitSelections} models' worth of selections`,
              `top two hold ${summary.topTwoLinePoints} of ${summary.totalPoints}`,
            ].join(" · ")}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {healthSummary.reason}
        </Typography>
      </Stack>

      <Tabs value={tab} variant="scrollable" allowScrollButtonsMobile
        onChange={(_, next: "flagged" | "roles" | "good") => setTab(next)}
        sx={{ borderBottom: `1px solid ${tokens.rule}`, minHeight: 44 }}>
        <Tab value="flagged" sx={{ minHeight: 44 }}
          label={`Flagged ${counts.flagged}`} />
        <Tab value="roles" sx={{ minHeight: 44 }}
          label={`Role balance ${counts.roles}`} />
        <Tab value="good" sx={{ minHeight: 44 }}
          label={`In your favour ${counts.good}`} />
      </Tabs>

      {tab === "flagged" ? (
        counts.flagged
          ? <Notes title="" items={health.flaggedIssues} />
          : <Empty said="Nothing flagged. The shape of this list holds up." />
      ) : null}

      {tab === "roles" ? <Notes title="" items={health.roleBalance} /> : null}

      {tab === "good" ? (
        counts.good
          ? <Good title="" items={health.strengths} />
          : <Empty said="Nothing is standing out yet. Work through the flagged list above." />
      ) : null}

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Worked out from the unit names and the points, here, with nothing sent
        anywhere. It is a shape check rather than a rules check.
      </Typography>
    </Stack>
  );
}

function Empty({ said }: { said: string }) {
  return (
    <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{said}</Typography>
  );
}
