import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";
import type { ClubDetail } from "@/types/clubDetail";

/**
 * Sections are built as an array and filtered before rendering. MUI 9's Stack
 * throws if a `divider` is set and any child is null, and every block here is
 * conditional — so separators are drawn with a border instead.
 */
export default function ClubSidebar({ club }: { club: ClubDetail }) {
  const address = [club.venue.name, club.venue.address, club.venue.postcode].filter(Boolean);

  const sections: { title: string; body: React.ReactNode }[] = [];

  if (address.length) {
    sections.push({
      title: "Venue",
      body: (
        <Stack spacing={0.25}>
          {address.map((line) => (
            <Typography key={line} variant="body2">{line}</Typography>
          ))}
        </Stack>
      ),
    });
  }

  if (club.schedule.length) {
    sections.push({
      title: "Schedule",
      body: (
        <Stack spacing={0.5}>
          {club.schedule.map((s, i) => (
            <Typography key={i} sx={{ fontFamily: mono, fontSize: "0.85rem" }}>
              {s.day} {s.time}
              {s.label ? (
                <Typography component="span" variant="body2" color="text.secondary"> · {s.label}</Typography>
              ) : null}
            </Typography>
          ))}
        </Stack>
      ),
    });
  }

  const chipList = (values: string[]) => (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      {values.map((v) => <Chip key={v} size="small" variant="outlined" label={v} />)}
    </Stack>
  );

  if (club.facilities.length) sections.push({ title: "Facilities", body: chipList(club.facilities) });
  if (club.accessibility.length) sections.push({ title: "Accessibility", body: chipList(club.accessibility) });

  if (club.paymentMethods.length) {
    sections.push({
      title: "Payment",
      body: <Typography variant="body2" color="text.secondary">{club.paymentMethods.join(" · ")}</Typography>,
    });
  }

  if (club.ages) {
    sections.push({ title: "Ages", body: <Typography variant="body2">{club.ages}</Typography> });
  }

  const links = [
    club.contact.email ? { href: `mailto:${club.contact.email}`, label: club.contact.email, external: false } : null,
    club.contact.website ? { href: club.contact.website, label: "Visit website", external: true } : null,
    ...club.socialLinks.map((l) => ({ href: l.url, label: l.label, external: true })),
  ].filter(Boolean) as { href: string; label: string; external: boolean }[];

  if (links.length) {
    sections.push({
      title: "Contact",
      body: (
        <Stack spacing={0.5}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              variant="body2"
              {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {l.label}
            </Link>
          ))}
        </Stack>
      ),
    });
  }

  return (
    <Card component="aside">
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={2.5}>
          {sections.map((section, i) => (
            <Stack
              key={section.title}
              spacing={1}
              sx={i > 0 ? { pt: 2.5, borderTop: `1px solid ${tokens.rule}` } : undefined}
            >
              <Typography variant="overline" color="text.secondary">{section.title}</Typography>
              {section.body}
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
