import Stack from "@mui/material/Stack";
import LinkButton from "./LinkButton";
import TuneIcon from "@mui/icons-material/Tune";

/**
 * The way into the console, from the page it manages.
 *
 * Sits under the hero on a club or event page for anybody on the team. Without
 * it, an owner looking at their own club has to remember a URL or go back out
 * to My Clubs, which is the sort of thing that makes a console feel like a
 * separate product rather than the same one.
 *
 * Outlined rather than contained: the page belongs to the club's members and
 * the primary action on it is theirs, not the owner's.
 */
export default function ManageStrip({
  links,
}: {
  links: { label: string; href: string }[];
}) {
  if (links.length === 0) return null;

  return (
    <Stack direction="row" spacing={1.5} useFlexGap
      sx={{ flexWrap: "wrap", mt: 2.5 }}>
      {links.map((link, index) => (
        <LinkButton
          key={link.href}
          href={link.href}
          variant="outlined"
          size="small"
          startIcon={index === 0 ? <TuneIcon /> : undefined}
          // A wrapping row stretches its children, which centres their labels.
          sx={{ alignSelf: "flex-start" }}
        >
          {link.label}
        </LinkButton>
      ))}
    </Stack>
  );
}
