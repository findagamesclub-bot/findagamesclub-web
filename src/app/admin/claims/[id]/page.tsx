import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonIcon from "@mui/icons-material/PersonOutlineOutlined";
import GavelIcon from "@mui/icons-material/Gavel";
import Panel from "@/components/members/Panel";
import PageHead from "@/components/ui/PageHead";
import LongText from "@/components/ui/LongText";
import ClaimActions from "@/components/admin/ClaimActions";
import { getClaim } from "@/services/claims.service";
import { adminCanAnswer, claimLabel, claimTone } from "@/utils/claim-status";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "A claim" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }}
      sx={{ alignItems: { sm: "baseline" } }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.08em", color: tokens.inkMuted,
                        minWidth: { sm: 92 }, flexShrink: 0 }}>
        {label.toUpperCase()}
      </Typography>
      <Typography variant="body2" sx={{ minWidth: 0, wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Stack>
  );
}

/**
 * One claim: what they said, and the two things to do about it.
 *
 * Handing a club over is the most consequential thing in this console: it gives
 * somebody the members, the money and the events of a club that already runs.
 * So the evidence gets the room and the buttons ask first.
 */
export default async function ClaimPage({ params }: PageProps<"/admin/claims/[id]">) {
  const { id } = await params;

  const claim = await getClaim(Number(id));
  if (!claim) notFound();

  const tone = claimTone(claim.status);

  return (
    <>
      <NextLink href="/admin/claims" style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>Back to claims</Typography>
        </Stack>
      </NextLink>

      <PageHead
        title={claim.club?.name ?? "A club that has gone"}
        lede={[
          claim.club?.city,
          `asked ${shortDate(claim.created_at.slice(0, 10))}`,
        ].filter(Boolean).join(" · ")}
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2.5, alignItems: "center", flexWrap: "wrap" }}
        useFlexGap>
        <Chip size="small" label={claimLabel(claim.status)}
          sx={{ fontWeight: 700, color: "#fff",
                bgcolor: tone === "good" ? tokens.positive
                  : tone === "bad" ? tokens.danger
                    : tone === "warn" ? tokens.brass : tokens.inkMuted }} />
        {claim.club?.slug ? (
          <NextLink href={`/clubs/${claim.club.slug}`}
            style={{ color: tokens.brand, fontSize: "0.85rem" }}>
            Open the listing they want
          </NextLink>
        ) : null}
      </Stack>

      <Box sx={{ display: "grid", gap: 3, alignItems: "start",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(280px, 1fr)" } }}>
        <Stack spacing={2.5}>
          <Panel title="What they said" icon={GavelIcon}>
            <LongText text={claim.message || "They wrote nothing."} lines={14} />
          </Panel>

          {claim.evidence ? (
            <Panel title="What they sent as proof">
              <LongText text={claim.evidence} lines={9} />
            </Panel>
          ) : null}

          {claim.decision_note ? (
            <Panel title="What was said back">
              <LongText text={claim.decision_note} lines={9} />
            </Panel>
          ) : null}
        </Stack>

        <Stack spacing={2.5}>
          <Panel title="Who is asking" icon={PersonIcon}>
            <Stack spacing={1.25}>
              <Row label="Name" value={claim.claimant?.full_name || "No name set"} />
              <Row label="Asked" value={shortDate(claim.created_at.slice(0, 10)) ?? ""} />
              {claim.decided_at ? (
                <Row label="Answered"
                  value={shortDate(claim.decided_at.slice(0, 10)) ?? ""} />
              ) : null}
            </Stack>
          </Panel>

          {adminCanAnswer(claim.status) ? (
            <Panel title="Your answer">
              <ClaimActions
                id={claim.id}
                clubName={claim.club?.name ?? "this club"}
                claimantName={claim.claimant?.full_name || "They"}
              />
            </Panel>
          ) : (
            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
              This one has been answered. Nothing left to do.
            </Typography>
          )}
        </Stack>
      </Box>
    </>
  );
}
