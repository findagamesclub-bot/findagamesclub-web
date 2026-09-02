import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
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
import SocialLinks from "./SocialLinks";
import ScheduleList from "./ScheduleList";
import Button from "@mui/material/Button";
import LanguageIcon from "@mui/icons-material/Language";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { externalUrl } from "@/utils/external-url";
import { tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import type { ClubDetail } from "@/types/clubDetail";

/**
 * Sections are built as an array and filtered before rendering. MUI 9's Stack
 * throws if a `divider` is set and any child is null, and every block here is
 * conditional — so separators are drawn with a border instead.
 */
export default function ClubSidebar({ club }: { club: ClubDetail }) {
  const { faction } = clubIdentity(club.slug, club.name);
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

  // Both ways of reaching a club are buttons, and the same size. They are the
  // two things somebody does from this panel, and a text link beside a button
  // reads as the lesser of the two when neither is.
  //
  // Email is a button rather than a printed address for a second reason:
  // printing it made the club's inbox scrapeable from a public page, and
  // reading an address off a screen to type it somewhere else is work nobody
  // should do when the machine can open the message for them.
  //
  // Validated rather than trusted: clubs type these by hand, and one that
  // cannot be opened is hidden instead of rendered going nowhere.
  const website = externalUrl(club.contact.website);

  if (club.contact.email || website || club.socialLinks.length) {
    sections.push({
      title: "Contact",
      icon: MailIcon,
      body: (
        <Stack spacing={1.25}>
          {club.contact.email ? (
            <Button
              component="a"
              href={`mailto:${club.contact.email}?subject=${encodeURIComponent(club.name)}`}
              variant="outlined"
              fullWidth
              startIcon={<MailIcon sx={{ fontSize: 18 }} />}
              sx={{ minHeight: 44, color: tokens.ink, borderColor: tokens.rule,
                    "&:hover": { borderColor: faction.base, color: faction.deep } }}
            >
              Email club
            </Button>
          ) : null}

          {website ? (
            <Button
              component="a"
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              fullWidth
              startIcon={<LanguageIcon sx={{ fontSize: 18 }} />}
              // Leaves the site, so it says so. The mail button does not need
              // this because opening a mail client is not navigating away.
              endIcon={<OpenInNewIcon sx={{ fontSize: 15, opacity: 0.7 }} />}
              sx={{ minHeight: 44, color: tokens.ink, borderColor: tokens.rule,
                    "&:hover": { borderColor: faction.base, color: faction.deep } }}
            >
              Visit website
            </Button>
          ) : null}
          <SocialLinks links={club.socialLinks} slug={club.slug} name={club.name} />
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
