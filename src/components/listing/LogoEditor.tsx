"use client";

import { useRef } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddPhotoIcon from "@mui/icons-material/AddPhotoAlternate";
import BusyOverlay from "@/components/ui/BusyOverlay";
import ClubLogo from "@/components/clubs/ClubLogo";
import { useClubLogo, type LogoValue } from "@/hooks/useClubLogo";
import { type MediaOwner } from "@/utils/club-media";
import { mono, tokens } from "@/lib/tokens";

/**
 * The club's logo.
 *
 * Drawn through `ClubLogo` itself rather than as a square thumbnail, because
 * that is the one treatment it gets everywhere else: a squircle with a ring,
 * cropped to fill. A club editing a wide banner behind a square preview and
 * finding its name sliced off on every card is the mistake this avoids, and it
 * is the same argument the loyalty tone picker settled by showing the metal.
 *
 * The monogram showing through when there is no logo is not a placeholder, it
 * is what members actually see, so the panel says so instead of looking empty.
 */
export default function LogoEditor({
  owner, slug, name, initial,
}: {
  owner: MediaOwner;
  slug: string;
  name: string;
  initial: LogoValue;
}) {
  const { value, touched, removed, busy, error, pick, clear } = useClubLogo(owner, initial);
  const picker = useRef<HTMLInputElement>(null);

  return (
    <Stack spacing={1.5}>
      {/* Posted only once somebody has changed something. A club imported with
          a logo has a URL and no path, so an always-present empty field would
          clear the logo of every club that never opened this panel. */}
      {touched ? <input type="hidden" name="logoPath" value={value.path ?? ""} /> : null}
      {removed.map((path) => (
        <input key={`rl-${path}`} type="hidden" name="removedPhoto" value={path} />
      ))}

      <BusyOverlay busy={busy} variant="dim" label="Uploading">
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <ClubLogo slug={slug} name={name} logoUrl={value.url} size={76}
            ring={tokens.rule} />

          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {value.url
                ? "Shown beside your club's name on your page, in the directory and in every member's account."
                : "No logo yet, so your monogram stands in. It is shown beside your club's name wherever your club appears."}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Button variant="outlined" size="small" startIcon={<AddPhotoIcon />}
                disabled={busy} onClick={() => picker.current?.click()}>
                {value.url ? "Replace logo" : "Upload a logo"}
              </Button>
              {value.url ? (
                <Button variant="text" size="small" color="inherit"
                  disabled={busy} onClick={clear}
                  sx={{ color: tokens.inkMuted }}>
                  Remove
                </Button>
              ) : null}
            </Stack>

            <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                              letterSpacing: "0.08em", color: tokens.inkMuted }}>
              SQUARE WORKS BEST · JPEG, PNG OR WEBP
            </Typography>
          </Stack>
        </Stack>
      </BusyOverlay>

      {error ? (
        <Typography variant="body2" sx={{ color: tokens.danger }}>{error}</Typography>
      ) : null}

      {touched && !value.url ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Your logo comes off when you save, and your monogram takes its place.
        </Typography>
      ) : null}

      {/* A plain input, the same element PhotoEditor uses, rather than
          `Box component="input"`. Not worth being clever about: this one has
          to carry a ref and a change handler and nothing else. */}
      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
          event.target.value = "";
        }} />
    </Stack>
  );
}
