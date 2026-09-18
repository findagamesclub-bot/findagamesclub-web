import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BadgeIcon from "@mui/icons-material/AssignmentInd";
import PlaceIcon from "@mui/icons-material/Place";
import CategoryIcon from "@mui/icons-material/Category";
import PaymentsIcon from "@mui/icons-material/Payments";
import ScheduleIcon from "@mui/icons-material/Schedule";
import Panel from "@/components/members/Panel";
import LongText from "@/components/ui/LongText";
import { mono, tokens } from "@/lib/tokens";
import type { draftValues } from "@/utils/draft-values";

/**
 * Everything the club filled in, as read-only rows.
 *
 * Not an editable form. An admin correcting somebody's listing before approving
 * it is an admin answering for a club they do not run, and the club would never
 * know their own page had been rewritten. Sending it back with a note is slower
 * and honest.
 *
 * Grouped the way the five steps group it, so "step 3 is thin" is answerable by
 * looking rather than by opening the builder.
 */

type Values = ReturnType<typeof draftValues>;

function Row({ label, value, long = false }: {
  label: string;
  value: string;
  /** Free text a person typed, which has no length anybody controls. */
  long?: boolean;
}) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }}
      sx={{ alignItems: { sm: "baseline" } }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.08em", color: tokens.inkMuted,
                        minWidth: { sm: 132 }, flexShrink: 0 }}>
        {label.toUpperCase()}
      </Typography>
      {long && value ? (
        <LongText text={value} max={200} />
      ) : (
        <Typography variant="body2"
          sx={{ minWidth: 0, color: value ? tokens.ink : tokens.inkMuted }}>
          {value || "Not filled in"}
        </Typography>
      )}
    </Stack>
  );
}

const joined = (values: string[]) => values.join(", ");

export default function SubmissionDetails({ values }: { values: Values }) {
  const { profile, content, pricing, schedule } = values;

  return (
    <Stack spacing={2.5}>
      <Panel title="The club" icon={BadgeIcon}>
        <Stack spacing={1.25}>
          <Row label="Name" value={profile.name} />
          <Row label="Town or city" value={profile.city} />
          <Row label="Neighbourhood" value={profile.neighbourhood} />
          <Row label="Summary" value={profile.summary} long />
          <Row label="Description" value={profile.description} long />
          <Row label="Formats" value={joined(profile.formats)} />
        </Stack>
      </Panel>

      <Panel title="Where and who" icon={PlaceIcon}>
        <Stack spacing={1.25}>
          <Row label="Venue" value={profile.venueName} />
          <Row label="Address" value={profile.venueAddress} />
          <Row label="Postcode" value={profile.postcode} />
          <Row label="Website" value={profile.website} />
          <Row label="Contact email" value={profile.contactEmail} />
          <Row label="Ages" value={profile.ages} />
          <Row label="Members" value={profile.memberCount} />
          <Row label="Tables" value={profile.tablesAvailable} />
        </Stack>
      </Panel>

      <Panel title="What they play" icon={CategoryIcon}>
        <Stack spacing={1.25}>
          <Row label="Games" value={joined(content.games)} />
          <Row label="Facilities" value={joined(content.facilities)} />
          <Row label="Payment" value={joined(content.paymentMethods)} />
          <Row label="Elsewhere"
            value={joined(content.socialLinks.map((l) => `${l.label}: ${l.url}`))} />
          <Row label="Board categories"
            value={joined(content.categories.map((c) => c.label))} />
        </Stack>
      </Panel>

      <Panel title="What it costs" icon={PaymentsIcon}>
        <Stack spacing={1.25}>
          <Row label="Drop in"
            value={joined(pricing.models.map((m) =>
              [m.label, m.price].filter(Boolean).join(" "))) } />
          <Row label="Tiers"
            value={joined(pricing.tiers.map((t) =>
              `${t.label}${t.price ? ` ${t.price}` : ""}${t.isBasic ? " (join on)" : ""}`))} />
          <Row label="Loyalty" value={pricing.loyaltyEnabled ? "Collecting points" : "Off"} />
        </Stack>
      </Panel>

      <Panel title="When they meet" icon={ScheduleIcon}>
        <Stack spacing={1.25}>
          {schedule.nights.length ? (
            schedule.nights.map((night, i) => (
              <Row key={i} label={night.day || "Night"}
                value={[night.time, night.label].filter(Boolean).join(" · ")} />
            ))
          ) : (
            <Row label="Nights" value="" />
          )}
          <Row label="Noticeboard" value={joined(schedule.notices)} long />
        </Stack>
      </Panel>
    </Stack>
  );
}
