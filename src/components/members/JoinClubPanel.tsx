"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import VerifiedIcon from "@mui/icons-material/Verified";
import LoginIcon from "@mui/icons-material/Login";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ShieldIcon from "@mui/icons-material/Shield";
import ClubLinks from "./ClubLinks";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";
import NextLink from "next/link";
import { membershipAction, type MembershipState } from "@/app/clubs/[slug]/membership-actions";
import LinkPending from "@/components/ui/LinkPending";
import { useActionToast } from "@/components/ui/Toaster";
import { tokens, type Faction } from "@/lib/tokens";
import type { MyMembership } from "@/types/membership";
import type { MembershipTier } from "@/types/clubDetail";
import type { MembershipPayment, PaymentStanding } from "@/types/payment";
import MyPaymentsDialog from "./MyPaymentsDialog";
import { shortDate } from "@/utils/dates";

type Props = {
  clubId: number;
  slug: string;
  clubName: string;
  membership: MyMembership;
  signedIn: boolean;
  faction: Faction;
  /** Null when the viewer is not allowed to see the roster. */
  memberCount: number | null;
  tiers: MembershipTier[];
  /** Owners and admins get the queue link; everyone else never sees a count. */
  pendingCount: number | null;
  canManage: boolean;
  /** False when the club takes no table bookings at all. */
  takesBookings: boolean;
  hasLoyalty: boolean;
  hasShop: boolean;
  hasCoaching: boolean;
  /** The club has at least one scored pairing to show. */
  hasRivalries?: boolean;
  /** The club runs a league, ladder or campaign. */
  hasCompetitions?: boolean;
  /** Names in this club's results with no account against them. */
  unmatchedResults?: number;
  standing: PaymentStanding;
  payments: MembershipPayment[];
};

/**
 * One panel, four states: signed out, not a member, waiting, in. Each shows a
 * single next action — the legacy page showed every button at once and greyed
 * out the ones that did not apply, which read as broken.
 */
export default function JoinClubPanel({
  clubId, slug, clubName, membership, signedIn, faction, memberCount, pendingCount, tiers, canManage, takesBookings,
  hasLoyalty, hasShop, hasCoaching, hasRivalries = false, hasCompetitions = false,
  unmatchedResults = 0,
  standing, payments,
}: Props) {
  // Default to the free tier when there is one, so the common case is one click.
  const [tierKey, setTierKey] = useState(
    () => (tiers.find((t) => t.isBasic) ?? tiers[0])?.key ?? "",
  );
  // One state for both forms: two could disagree, and the older of the pair
  // used to win — leaving "Request sent." sitting above an "Ask to join" button.
  const [state, submit, busy] = useActionState<MembershipState, FormData>(membershipAction, {});
  useActionToast(state);
  const joining = busy;
  const leaving = busy;

  const approved = membership.status === "approved";
  const pending = membership.status === "pending";

  // Someone who runs the club has no business applying to it — they could
  // approve themselves, and the queue would show their own name.
  const manages = canManage && !approved && !pending;

  /**
   * What membership actually buys you here. The old copy promised table
   * booking to every club, including ones that have never set a table count.
   */
  const offers = [
    takesBookings ? "book tables" : null,
    hasCoaching ? "book coaching" : null,
    hasShop ? "order merchandise" : null,
    hasLoyalty ? "earn loyalty points" : null,
    "see members-only posts",
  ].filter(Boolean).reduce((sentence, part, i, all) => {
    if (i === 0) return part as string;
    return i === all.length - 1 ? `${sentence} and ${part}` : `${sentence}, ${part}`;
  }, "");

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${approved || manages ? faction.base : tokens.rule}`,
        bgcolor: approved || manages ? faction.soft : tokens.paper,
      }}
    >
      <Stack spacing={1.5} sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          {manages ? (
            <ShieldIcon sx={{ color: faction.base, fontSize: 26 }} />
          ) : approved ? (
            <VerifiedIcon sx={{ color: faction.base, fontSize: 26 }} />
          ) : pending ? (
            <HourglassTopIcon sx={{ color: tokens.brass, fontSize: 26 }} />
          ) : (
            <GroupAddIcon sx={{ color: tokens.brand, fontSize: 26 }} />
          )}
          <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>
            {manages ? "You manage this club" : approved ? "You are a member" : pending ? "Request pending" : "Join this club"}
          </Typography>
        </Stack>

        {(approved || pending) && membership.tierKey ? (
          <Typography
            variant="body2"
            sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", letterSpacing: "0.04em",
                  textTransform: "uppercase", color: approved ? faction.deep : tokens.brass }}
          >
            {tiers.find((t) => t.key === membership.tierKey)?.label ?? membership.tierKey}
          </Typography>
        ) : null}

        {approved ? (
          <MyPaymentsDialog
            clubName={clubName}
            tierLabel={tiers.find((t) => t.key === membership.tierKey)?.label ?? null}
            standing={standing}
            payments={payments}
          />
        ) : null}

        <Typography variant="body2" color="text.secondary">
          {manages
            ? pendingCount
              ? `${pendingCount} ${pendingCount === 1 ? "person is" : "people are"} waiting for you to review.`
              : "You can review requests and see the full roster."
            : approved
            ? `You can ${offers} at ${clubName}.`
            : pending
              ? "The club has your request. You will get an email when they decide."
              : `Members of ${clubName} can ${offers}.`}
        </Typography>

        {membership.declineReason && !approved && !pending ? (
          <Alert severity="info" sx={{ fontSize: "0.85rem" }}>
            A previous request was declined: {membership.declineReason}
          </Alert>
        ) : null}


        {manages ? (
          <Button
            component={NextLink}
            href={`/clubs/${slug}/members`}
            variant="contained"
            fullWidth
            startIcon={<ShieldIcon />}
            sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}
          >
            {pendingCount ? `Review ${pendingCount} request${pendingCount === 1 ? "" : "s"}` : "Manage members"}
          </Button>
        ) : null}

        {/* Only while there is something to match. A club whose results are
            all attached should not be offered a page of nothing. */}
        {manages && unmatchedResults ? (
          <Button
            component={NextLink}
            href={`/clubs/${slug}/results`}
            variant="outlined"
            fullWidth
            startIcon={
              <LinkPending size={18}>
                <EmojiEventsIcon />
              </LinkPending>
            }
            sx={{ bgcolor: tokens.paper, color: tokens.ink, borderColor: tokens.brass,
                  "&:hover": { bgcolor: tokens.paper, borderColor: faction.base,
                               color: faction.deep } }}
          >
            {`Match ${unmatchedResults} result${unmatchedResults === 1 ? "" : "s"}`}
          </Button>
        ) : null}

        {manages && takesBookings ? (
          <Button
            component={NextLink}
            href={`/clubs/${slug}/bookings`}
            variant="outlined"
            fullWidth
            startIcon={<TableRestaurantIcon />}
            sx={{ bgcolor: tokens.paper, color: tokens.ink, borderColor: tokens.rule,
                  "&:hover": { bgcolor: tokens.paper, borderColor: faction.base, color: faction.deep } }}
          >
            See the tables
          </Button>
        ) : null}

        {manages ? (
          <ClubLinks slug={slug} faction={faction}
            hasLoyalty={hasLoyalty} hasShop={hasShop} hasCoaching={hasCoaching}
            hasRivalries={hasRivalries} hasCompetitions={hasCompetitions} />
        ) : null}

        {!signedIn ? (
          <Button
            component={NextLink}
            href={`/auth/sign-in?next=/clubs/${slug}`}
            variant="contained"
            startIcon={<LoginIcon />}
            fullWidth
          >
            Sign in to join
          </Button>
        ) : approved ? (
          <Stack spacing={1.25}>
            {/* Booking is what a member comes here to do; leaving is rare. The
                primary button follows the likely action, not the panel's name. */}
            {takesBookings ? (
              <Button
                component={NextLink}
                href={`/clubs/${slug}/bookings`}
                variant="contained"
                fullWidth
                startIcon={
                  <LinkPending size={18} colour="#fff">
                    <TableRestaurantIcon />
                  </LinkPending>
                }
                sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}
              >
                Book a table
              </Button>
            ) : null}

            <ClubLinks slug={slug} faction={faction}
              hasLoyalty={hasLoyalty} hasShop={hasShop} hasCoaching={hasCoaching}
            hasRivalries={hasRivalries} hasCompetitions={hasCompetitions} />

          <form action={submit}>
            <input type="hidden" name="intent" value="leave" />
            <input type="hidden" name="membershipId" value={membership.id ?? ""} />
            <input type="hidden" name="slug" value={slug} />
            {/* Outlined rather than filled: leaving is a real action and needs
                to look like a button, but it should not compete with the
                primary one on any other club page. The border turns red only on
                hover, so the destructive edge shows at the point of clicking. */}
            <Button
              type="submit"
              variant="outlined"
              fullWidth
              loading={leaving}
              loadingPosition="start"
              startIcon={<LogoutIcon />}
              sx={{
                color: tokens.ink,
                bgcolor: tokens.paper,
                borderColor: tokens.rule,
                "&:hover": {
                  bgcolor: tokens.paper,
                  color: tokens.danger,
                  borderColor: tokens.danger,
                },
              }}
            >
              Leave club
            </Button>
          </form>
          </Stack>
        ) : pending ? (
          <form action={submit}>
            <input type="hidden" name="intent" value="leave" />
            <input type="hidden" name="membershipId" value={membership.id ?? ""} />
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" variant="outlined" size="small" fullWidth
              loading={leaving} loadingPosition="start" startIcon={<CloseIcon />}>
              Withdraw request
            </Button>
          </form>
        ) : (
          <form action={submit}>
            <input type="hidden" name="intent" value="join" />
            <input type="hidden" name="clubId" value={clubId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="tierKey" value={tierKey} />

            {tiers.length > 1 ? (
              <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Choose a membership</Typography>
                {tiers.map((tier) => {
                  const selected = tier.key === tierKey;
                  return (
                    <Box
                      key={tier.key}
                      component="button"
                      type="button"
                      onClick={() => setTierKey(tier.key)}
                      aria-pressed={selected}
                      sx={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 1,
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        px: 1.5,
                        py: 1,
                        borderRadius: 1.5,
                        font: "inherit",
                        border: `1.5px solid ${selected ? faction.base : tokens.rule}`,
                        bgcolor: selected ? faction.soft : "transparent",
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: selected ? 700 : 500 }}>
                        {tier.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: "var(--font-mono)", color: tokens.inkMuted }}>
                        {tier.price ?? "Free"}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            ) : null}
            <Button type="submit" variant="contained" fullWidth
              loading={joining} loadingPosition="start" startIcon={<GroupAddIcon />}>
              Ask to join
            </Button>
          </form>
        )}

        <Stack
          direction="row"
          spacing={1}
          sx={{ pt: 1.5, borderTop: `1px solid ${tokens.rule}`, alignItems: "baseline", flexWrap: "wrap" }}
        >
          <Typography
            component={NextLink}
            href={`/clubs/${slug}/members`}
            variant="body2"
            sx={{ color: tokens.brand, textDecoration: "none", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}
          >
            <LinkPending size={13}>
              <Box component="span" />
            </LinkPending>
            See members
          </Typography>
          {/* No bare count here: the header stat above is the club's own
              self-reported total, and a smaller live number next to it reads
              as a contradiction rather than as two different facts. */}
          {pendingCount ? (
            <Typography
              variant="body2"
              sx={{ ml: "auto", color: tokens.brass, fontWeight: 600 }}
            >
              {pendingCount} waiting
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
