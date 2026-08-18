import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import PlaceIcon from "@mui/icons-material/Place";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccessibleIcon from "@mui/icons-material/Accessible";
import PaymentsIcon from "@mui/icons-material/Payments";
import CakeIcon from "@mui/icons-material/Cake";
import MailIcon from "@mui/icons-material/Mail";
import FacilityChips from "./FacilityChips";
import ScheduleList from "./ScheduleList";
import { tokens } from "@/lib/tokens";
import type { ClubDetail } from "@/types/clubDetail";

/**
 * Sections are built as an array and filtered before rendering. MUI 9's Stack
 * throws if a `divider` is set and any child is null, and every block here is
 * conditional — so separators are drawn with a border instead.
 */
export default function ClubSidebar({ club }: { club: ClubDetail }) {
  const address = [club.venue.name, club.venue.address, club.venue.postcode].filter(Boolean);
  const sections: { title: string; icon: SvgIconComponent; body: React.ReactNode }[] = [];

  if (address.length) {
    sections.push({
      title: "Venue",
      icon: PlaceIcon,
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
      icon: CalendarMonthIcon,
      body: <ScheduleList schedule={club.schedule} slug={club.slug} name={club.name} />,
    });
  }

  if (club.facilities.length) {
    sections.push({ title: "Facilities", icon: CheckCircleIcon, body: <FacilityChips values={club.facilities} /> });
  }
  if (club.accessibility.length) {
    sections.push({ title: "Accessibility", icon: AccessibleIcon, body: <FacilityChips values={club.accessibility} /> });
  }
  if (club.paymentMethods.length) {
    sections.push({ title: "Payment", icon: PaymentsIcon, body: <FacilityChips values={club.paymentMethods} /> });
  }
  if (club.ages) {
    sections.push({ title: "Ages", icon: CakeIcon, body: <Typography variant="body2">{club.ages}</Typography> });
  }

  const links = [
    club.contact.email ? { href: `mailto:${club.contact.email}`, label: club.contact.email, external: false } : null,
    club.contact.website ? { href: club.contact.website, label: "Visit website", external: true } : null,
    ...club.socialLinks.map((l) => ({ href: l.url, label: l.label, external: true })),
  ].filter(Boolean) as { href: string; label: string; external: boolean }[];

  if (links.length) {
    sections.push({
      title: "Contact",
      icon: MailIcon,
      body: (
        <Stack spacing={0.5}>
          {/* Keyed by label: several clubs point every social link at the same
              placeholder URL, so hrefs are not unique. */}
          {links.map((l) => (
            <Link
              key={l.label}
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
              spacing={1.25}
              sx={i > 0 ? { pt: 2.5, borderTop: `1px solid ${tokens.rule}` } : undefined}
            >
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <section.icon aria-hidden sx={{ fontSize: 17, color: tokens.brass }} />
                <Typography variant="overline" color="text.secondary">{section.title}</Typography>
              </Stack>
              {section.body}
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
