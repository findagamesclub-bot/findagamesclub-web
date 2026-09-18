import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ReviewStep from "@/components/listing/ReviewStep";
import ProfileStep from "@/components/listing/ProfileStep";
import ScheduleStep from "@/components/listing/ScheduleStep";
import ListingList from "@/components/listing/ListingList";
import ReviewHistory from "@/components/listing/ReviewHistory";
import ReviewActions from "@/components/admin/ReviewActions";
import SubmissionQueue from "@/components/admin/SubmissionQueue";
import { listingChecks, type ReadinessInput } from "@/utils/listing-readiness";
import { ownerNextStep, STATUS_LABELS, STATUS_TONES } from "@/utils/submission-status";

/**
 * Local-only view of the listing health report.
 *
 * The review step is four clicks inside a console only an owner can open, so
 * the two states that matter were only ever seen by signing in as one. A
 * finished listing and a half-filled one look very different here on purpose,
 * and the half-filled one is where the layout has to work hardest.
 */
export default function ListingHealthPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const finished: ReadinessInput = {
    name: "Didcot Wargames", city: "Didcot", formats: ["Wargaming"],
    summary: "A friendly club", description: "Long description here",
    venueName: "North Moreton Village Hall", postcode: "OX11 9AT",
    venueAddress: "High Street", website: "https://example.com",
    contactEmail: "hello@example.com",
    ages: "18+", memberCount: 148, tablesAvailable: 10,
    featuredGames: ["Warhammer 40,000"], facilities: ["Parking"], paymentMethods: ["Cash"],
    basicMembershipPriced: true, loyaltyReady: true,
    sessions: [{ day: "Thursday", time: "18:30 - 22:30", label: "Club session" }],
  };

  // One box short in three places, which is the case the old checklist told
  // somebody nothing useful about.
  const halfway: ReadinessInput = {
    name: "Mana Wharf Social Club", city: "London", formats: ["Board games"],
    summary: "", description: "",
    venueName: "The Wharf", postcode: "SE1 2AA", venueAddress: "", website: "",
    contactEmail: "",
    ages: "All ages", memberCount: 40, tablesAvailable: null,
    featuredGames: ["Catan"], facilities: [], paymentMethods: ["Cash"],
    basicMembershipPriced: true, loyaltyReady: false,
    sessions: [],
  };

  // The case that started this: an admin asked three times and the screen
  // showed the third note as though it were the only one. A first attempt with
  // one line and a long note are both here, because those are the two ends the
  // layout has to hold.
  const history = [
    { id: 1, kind: "submitted", label: "Sent in", tone: "neutral", body: "",
      who: "Gulnabi Afridi", on: "2026-09-12T09:15:00Z" },
    { id: 2, kind: "changes_requested", label: "Sent back", tone: "warn",
      body: "Add a postcode and one photo.", who: "sara khan",
      on: "2026-09-14T11:02:00Z" },
    { id: 3, kind: "submitted", label: "Sent in", tone: "neutral", body: "",
      who: "Gulnabi Afridi", on: "2026-09-15T18:40:00Z" },
    { id: 4, kind: "changes_requested", label: "Sent back", tone: "warn",
      body: "correct timing more.", who: "sara khan", on: "2026-09-16T08:20:00Z" },
    { id: 5, kind: "submitted", label: "Sent in", tone: "neutral", body: "",
      who: "Gulnabi Afridi", on: "2026-09-17T21:05:00Z" },
    { id: 6, kind: "declined", label: "Declined", tone: "bad",
      body: "Work more on it. ".repeat(30), who: "sara khan",
      on: "2026-09-18T10:00:00Z" },
  ];

  // One card per state, because the two that matter most are the ones nobody
  // reaches by testing: a listing that was declined and one that was stopped,
  // both of which offered no action at all until 0106. The declined card holds
  // a reason at the 600-character cap, which is where the next-step line used
  // to run a card down the page.
  const cards = [
    { id: 1, status: "draft", clubName: "Mana Wharf Social Club", city: "London",
      resume: "Step 3 of 5, Pricing", lastStep: "pricing", said: "" },
    { id: 2, status: "review_pending", clubName: "Sheffield Steel Wargamers",
      city: "Sheffield", resume: "", lastStep: "review", said: "" },
    { id: 3, status: "changes_requested", clubName: "Leeds Test Club", city: "Leeds",
      resume: "", lastStep: "review", said: "Add a postcode and one photo." },
    { id: 4, status: "approved", clubName: "Didcot Wargames", city: "Didcot",
      resume: "", lastStep: "review", said: "" },
    { id: 5, status: "declined", clubName: "The Dice Shop", city: "Oxford",
      resume: "", lastStep: "review",
      said: "This is a shop rather than a club, so it belongs somewhere else. "
        .repeat(8) },
    { id: 6, status: "cancelled", clubName: "Abingdon Games", city: "Abingdon",
      resume: "", lastStep: "schedule", said: "" },
  ].map((card) => ({
    ...card,
    statusLabel: STATUS_LABELS[card.status as keyof typeof STATUS_LABELS] ?? card.status,
    tone: STATUS_TONES[card.status as keyof typeof STATUS_TONES] ?? "neutral",
    next: ownerNextStep(card.status, { resume: card.resume }),
    clubId: card.status === "approved" ? 9 : null,
    clubSlug: card.status === "approved" ? "didcot-wargames-didcot" : "",
    clubStatus: card.status === "approved" ? "paused" : "",
    history: ["declined", "review_pending"].includes(card.status) ? history : [],
    // The waiting one is a second go, so it carries what the first ended as
    // rather than leaving that as a card of its own beside it.
    attempt: card.status === "review_pending" ? 2 : 1,
    from: card.status === "review_pending"
      ? { statusLabel: "declined", on: "2026-09-17T10:00:00Z",
          reason: "Work more on it." }
      : null,
    updatedAt: "2026-09-18T10:00:00Z",
  }));

  // The admin queue, which is otherwise behind a login. The rows that matter
  // are the pair: a decline that was started again, and the attempt that
  // replaced it, both of which the client hit on a real review.
  const queueRows = [
    { id: 11, status: "review_pending", statusLabel: "Awaiting admin approval",
      tone: "warn", clubName: "Leeds Meeple Society", city: "Leeds",
      submittedAt: "2026-09-10T09:00:00Z", updatedAt: "2026-09-10T09:00:00Z",
      clubId: null, note: "", reason: "", restartedFrom: null, sentBack: 0,
      clubStatus: "", supersededBy: null },
    { id: 12, status: "review_pending", statusLabel: "Awaiting admin approval",
      tone: "warn", clubName: "Sheffield Steel Wargamers", city: "Sheffield",
      submittedAt: "2026-09-18T09:00:00Z", updatedAt: "2026-09-18T09:00:00Z",
      clubId: null, note: "correct timing more.", reason: "",
      restartedFrom: 13, sentBack: 4, clubStatus: "", supersededBy: null },
    { id: 13, status: "declined", statusLabel: "Declined", tone: "bad",
      clubName: "Sheffield Steel Wargamers", city: "Sheffield",
      submittedAt: "2026-09-12T09:00:00Z", updatedAt: "2026-09-17T09:00:00Z",
      clubId: null, note: "", reason: "Work more on it.", restartedFrom: null,
      sentBack: 1, clubStatus: "paused",
      supersededBy: { id: 12, statusLabel: "approved and live" } },
  ];

  const empty = {
    name: "", city: "", neighbourhood: "", summary: "", description: "",
    formats: [] as string[], venueName: "", venueAddress: "", postcode: "",
    website: "", contactEmail: "", ages: [] as string[],
    memberCount: "", tablesAvailable: "",
  };

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={5}>
        <Stack spacing={2}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
            Step 1, where a refused save must not empty the form
          </Typography>
          <ProfileStep target={{ kind: "draft", id: 0 }} values={empty} />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
            Step 4, where the hours are two pickers and one stored string
          </Typography>
          <ScheduleStep
            target={{ kind: "draft", id: 0 }}
            nights={[
              { id: "", day: "Tuesday", time: "18:30 - 22:30", label: "Open play", booked: 0 },
              { id: "", day: "Friday", time: "20:00 - 01:00", label: "Late night", booked: 0 },
              // A club that wrote words rather than a clock time keeps them.
              { id: "", day: "Sunday", time: "first Sunday, afternoon", label: "Campaign", booked: 0 },
            ]}
            notices={["New members welcome any Tuesday."]}
          />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>Finished listing</Typography>
          <ReviewStep checks={listingChecks(finished)}
            base="/clubs/didcot-wargames-didcot/manage/listing"
            clubSlug="didcot-wargames-didcot" />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
            The queue, where a decline that was started again has to say so
          </Typography>
          <SubmissionQueue
            rows={queueRows}
            counts={new Map([["review_pending", 2], ["changes_requested", 0],
                             ["approved", 0], ["declined", 1], ["all", 3]])}
            filters={{ status: "all", query: "", sort: "oldest", page: 1 }}
            total={queueRows.length} page={1} perPage={25} />
        </Stack>

        <Stack spacing={2} sx={{ maxWidth: 380 }}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
            The answer, where publishing has to be asked about first
          </Typography>
          {/* Behind an admin login otherwise, so the one irreversible button in
              the console was never looked at outside a real review. */}
          <ReviewActions id={0} clubName="Sheffield Steel Wargamers" ready missing={0} />
        </Stack>

        <Stack spacing={2} sx={{ maxWidth: 380 }}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
            The same answer with checks still failing
          </Typography>
          <ReviewActions id={0} clubName="Leeds Test Club" ready={false} missing={2} />
        </Stack>

        <Stack spacing={2} sx={{ maxWidth: 380 }}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
            Six rounds in the column the admin actually reads it in
          </Typography>
          <ReviewHistory entries={history} />
        </Stack>

        <Stack spacing={2} sx={{ maxWidth: 380 }}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
            A first attempt, where there is nothing to tell yet
          </Typography>
          <ReviewHistory entries={history.slice(0, 1)} />
        </Stack>

        <Stack spacing={2} sx={{ maxWidth: 380 }}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
            A listing that was already finished when 0107 arrived
          </Typography>
          {/* The backfilled case. It has to say the record is partial, or it
              reads as "nothing has been asked for" above a decline with a
              reason on it, which is what shipped. */}
          <ReviewHistory entries={history.slice(5)} />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
            Every state a listing can be in, and what each one offers
          </Typography>
          <ListingList cards={cards} />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>Half-filled listing</Typography>
          <ReviewStep checks={listingChecks(halfway)}
            base="/clubs/mana-wharf-social-club-london/manage/listing"
            clubSlug="mana-wharf-social-club-london" />
        </Stack>
      </Stack>
    </Container>
  );
}
