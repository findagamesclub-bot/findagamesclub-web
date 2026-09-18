import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChecklistIcon from "@mui/icons-material/FactCheck";
import PersonIcon from "@mui/icons-material/PersonOutlineOutlined";
import Panel from "@/components/members/Panel";
import PageHead from "@/components/ui/PageHead";
import HealthCheck from "@/components/listing/HealthCheck";
import ReviewActions from "@/components/admin/ReviewActions";
import SubmissionDetails from "@/components/admin/SubmissionDetails";
import LongText from "@/components/ui/LongText";
import ReviewHistory from "@/components/listing/ReviewHistory";
import {
  getEarlierAttempt, getReviewHistory, getSubmissionForReview, getSubmitter,
} from "@/services/submissionReview.service";
import { draftReadiness } from "@/services/submissions.service";
import { adminCanReview, STATUS_LABELS, STATUS_TONES } from "@/utils/submission-status";
import { draftValues } from "@/utils/draft-values";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "Review a listing" };

/**
 * One listing, everything in it, and the three things to do about it.
 *
 * The checks on the right are the same eight the club was shown while filling
 * it in, from the same function, so a reviewer and a submitter are never
 * looking at different standards.
 *
 * Read-only rows rather than an editable form on purpose. An admin correcting
 * somebody's listing before approving it is an admin answering for a club they
 * do not run; sending it back with a note is slower and honest.
 */
/** The same label-and-value row `SubmissionDetails` uses, so the two agree. */
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

export default async function ReviewSubmissionPage({
  params,
}: PageProps<"/admin/submissions/[id]">) {
  const { id } = await params;

  const submission = await getSubmissionForReview(Number(id));
  if (!submission) notFound();

  // One wave. The history is always drawn and the earlier attempt almost never
  // exists, so asking for both together costs a listing that has been here
  // before nothing extra and costs every other one nothing at all.
  const [history, earlier, submitter] = await Promise.all([
    getReviewHistory(Number(id), { names: true }),
    getEarlierAttempt(submission.restarted_from),
    getSubmitter(submission.owner_id),
  ]);

  const payload = submission.payload ?? {};
  const { checks } = draftReadiness(payload);
  const values = draftValues(payload);

  const missing = checks.filter((c) => !c.ready).length;
  const status = submission.status as keyof typeof STATUS_LABELS;
  const tone = STATUS_TONES[status] ?? "neutral";

  // How many rounds this one has had. Counted from the log rather than guessed
  // from the note, so it says four when it went round four times: the note only
  // ever held the latest, and a chip reading "Second attempt" beside it counted
  // submission rows, which is a different fact entirely.
  const sentBack = history.filter((entry) => entry.kind === "changes_requested").length;

  return (
    <>
      <NextLink href="/admin/submissions" style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Back to listings
          </Typography>
        </Stack>
      </NextLink>

      <PageHead
        title={submission.club_name || "Untitled listing"}
        lede={[
          submission.city,
          submission.submitted_at
            ? `sent ${shortDate(submission.submitted_at.slice(0, 10))}`
            : "not sent yet",
        ].filter(Boolean).join(" · ")}
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <Chip size="small" label={STATUS_LABELS[status] ?? submission.status}
          sx={{ fontWeight: 700, color: "#fff",
                bgcolor: tone === "good" ? tokens.positive
                  : tone === "bad" ? tokens.danger
                    : tone === "warn" ? tokens.brass : tokens.inkMuted }} />
        {sentBack > 0 ? (
          <Chip size="small"
            label={sentBack === 1 ? "Sent back once" : `Sent back ${sentBack} times`}
            sx={{ fontWeight: 700, color: "#fff", bgcolor: tokens.brand }} />
        ) : null}
        {submission.club_id ? (
          <Typography variant="body2">
            Live at{" "}
            <NextLink href="/admin/submissions" style={{ color: tokens.brand }}>
              club #{submission.club_id}
            </NextLink>
          </Typography>
        ) : null}
      </Stack>

      <Box sx={{ display: "grid", gap: 3, alignItems: "start",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(280px, 1fr)" } }}>
        <SubmissionDetails values={values} />

        <Stack spacing={2.5}>
          <Panel title={`Readiness · ${checks.length - missing} of ${checks.length}`}
            icon={ChecklistIcon}>
            <Stack spacing={1}>
              {checks.map((check) => (
                // No base, so nothing here links into a builder that is not
                // this reviewer's to open.
                <HealthCheck key={check.key} check={check} base="" />
              ))}
            </Stack>
          </Panel>

          {/* The club started this one again from a listing that ended. A
              reviewer with no memory of last month otherwise reads it as a new
              club, and the reason it was turned down is the one thing most
              worth having in front of them. */}
          {earlier ? (
            <Panel title="They have been here before">
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {`This club asked once before and that request was `
                    + `${earlier.statusLabel.toLowerCase()}`
                    + (earlier.on ? ` on ${shortDate(earlier.on.slice(0, 10))}` : "")
                    + ". They began this one from it, so everything they had "
                    + "typed carried across."}
                </Typography>
                {earlier.reason ? <LongText text={earlier.reason} max={160} /> : null}
                <NextLink href={`/admin/submissions/${earlier.id}`}
                  style={{ color: tokens.brand, fontSize: "0.85rem" }}>
                  Read the earlier one
                </NextLink>
              </Stack>
            </Panel>
          ) : null}

          {/* Who is asking. The same name on a fourth club, or an account made
              ten minutes ago, is the context the decision actually turns on,
              and it was nowhere on this screen. */}
          {submitter ? (
            <Panel title="Who is asking" icon={PersonIcon}>
              <Stack spacing={1.25}>
                <Row label="Name" value={submitter.name || "No name set"} />
                <Row label="Email" value={submitter.email || "Not available"} />
                <Row label="Joined"
                  value={submitter.joinedAt
                    ? (shortDate(submitter.joinedAt.slice(0, 10)) ?? "Not known")
                    : "Not known"} />
                <Row label="Clubs live"
                  value={submitter.clubsOwned === 0
                    ? "None yet"
                    : `${submitter.clubsOwned} already running`} />
                <Row label="Listings"
                  value={submitter.listings === 1
                    ? "This is their first" : `${submitter.listings} started here`} />
              </Stack>
            </Panel>
          ) : null}

          {adminCanReview(submission.status) ? (
            <Panel title="Your answer">
              <ReviewActions
                id={submission.id}
                clubName={submission.club_name || "This club"}
                ready={missing === 0}
                missing={missing}
              />
            </Panel>
          ) : (
            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
              This one has been answered. Nothing left to do.
            </Typography>
          )}

          {/* Every ask, not the last one. A single `review_note` column meant a
              listing that went round three times showed the third note as
              though it were the only one, so neither side could tell whether
              the club was working through the list or going in circles.

              Under the answer rather than over it: a reviewer can paste six
              hundred characters into a note, and this used to be what pushed
              Approve off the bottom of the screen. */}
          {history.length ? (
            <Panel title="What has happened">
              <ReviewHistory entries={history} />
            </Panel>
          ) : null}
        </Stack>
      </Box>
    </>
  );
}
