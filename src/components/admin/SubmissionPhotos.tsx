import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ImageIcon from "@mui/icons-material/Collections";
import Panel from "@/components/members/Panel";
import ClubLogo from "@/components/clubs/ClubLogo";
import { clubImageUrl, clubLogoUrl } from "@/utils/club-media";
import { publicUrl } from "@/lib/supabase/storage";
import { mono, tokens } from "@/lib/tokens";

/**
 * What the club will look like, for somebody deciding whether to publish it.
 *
 * The review screen had every field as a row and not one picture, because
 * until 0160 a listing could not carry any: the builder told people photos
 * came later. So an admin approved a club sight unseen and found out what was
 * on its page at the same time as the public did. The client asked for exactly
 * this, in these words: "so admin can review photos before approving".
 *
 * Read-only, like every other panel here. An admin who can swap a club's
 * photographs is answering for a club they do not run.
 */
export default function SubmissionPhotos({
  name, logoPath, photos,
}: {
  name: string;
  logoPath: string | null;
  photos: { path: string | null; src: string; alt: string }[];
}) {
  const logo = clubLogoUrl({ logoPath }, publicUrl);

  return (
    <Panel title="Logo and photos" icon={ImageIcon}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <ClubLogo slug={name} name={name} logoUrl={logo} size={56} ring={tokens.rule} />
          <Typography variant="body2" sx={{ color: logo ? tokens.ink : tokens.inkMuted }}>
            {logo
              ? "Their logo, as it will appear beside the club's name."
              : "No logo. Their monogram stands in, which is what members will see."}
          </Typography>
        </Stack>

        {photos.length === 0 ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            No photos. The club page will draw a battle mat in their faction
            colour instead, so this is thin rather than broken.
          </Typography>
        ) : (
          <Stack spacing={1}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                              letterSpacing: "0.08em", color: tokens.inkMuted }}>
              {photos.length} {photos.length === 1 ? "PHOTO" : "PHOTOS"}
            </Typography>

            <Box sx={{ display: "grid", gap: 1.25,
                       gridTemplateColumns: {
                         xs: "repeat(2, minmax(0, 1fr))",
                         sm: "repeat(3, minmax(0, 1fr))" } }}>
              {photos.map((photo, index) => (
                <Stack key={`${photo.path ?? photo.src}-${index}`} spacing={0.5}>
                  <Box sx={{ aspectRatio: "16 / 10", borderRadius: 1, overflow: "hidden",
                             border: `1px solid ${tokens.rule}`,
                             backgroundColor: tokens.surface }}>
                    {/* Not next/image: half of these are imported absolute URLs
                        on somebody else's domain. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clubImageUrl({ src: photo.src, storagePath: photo.path }, publicUrl)}
                      alt={photo.alt || `Photo ${index + 1} of ${name}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </Box>
                  {/* The alt text is part of what is being reviewed: a listing
                      whose photos say nothing is one screen readers skip. */}
                  <Typography variant="caption"
                    sx={{ color: photo.alt ? tokens.inkMuted : tokens.brass }}>
                    {index === 0 ? "Header and card · " : ""}
                    {photo.alt || "No description"}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}
