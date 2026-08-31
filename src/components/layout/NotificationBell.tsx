"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NotificationsIcon from "@mui/icons-material/NotificationsNoneOutlined";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import StorefrontIcon from "@mui/icons-material/Storefront";
import SchoolIcon from "@mui/icons-material/School";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import GavelIcon from "@mui/icons-material/Gavel";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import type { SvgIconComponent } from "@mui/icons-material";
import {
  loadNotificationsAction, readAllAction, readOneAction,
} from "@/app/notification-actions";
import { createClient } from "@/lib/supabase/client";
import { sinceLabel } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { Notification } from "@/services/notifications.service";

const ICONS: Record<string, SvgIconComponent> = {
  message: ForumIcon,
  join_request: PersonAddIcon,
  membership: CardMembershipIcon,
  tier: CardMembershipIcon,
  tier_request: ArrowUpwardIcon,
  rival: LocalFireDepartmentIcon,
  order: StorefrontIcon,
  // What the club is told, as opposed to what the member is told.
  order_placed: StorefrontIcon,
  coaching_booked: SchoolIcon,
  // A score went in, or the club settled one.
  result_recorded: SportsEsportsIcon,
  result_state: GavelIcon,
  // Somebody put you on a table, or the waiting list came good.
  booked_in: EventSeatIcon,
  waitlist_promoted: EventSeatIcon,
  // What the club is told, as opposed to what the players are told.
  table_booked: TableRestaurantIcon,
  booking_cancelled: EventBusyIcon,
};

/**
 * Everything waiting on this person, in one place.
 *
 * The count comes from the server on first paint and is kept live by a
 * realtime subscription, so the badge is right without polling. The rows are
 * fetched only when the panel opens: this sits on every page for every
 * signed-in person, and a list nobody looks at is a query nobody needed.
 */
export default function NotificationBell({
  viewerId, initialUnread,
}: {
  viewerId: string;
  initialUnread: number;
}) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  // The server's count plus whatever has happened since. Adjusted during
  // render rather than in an effect: an effect that mirrors a prop into state
  // renders twice on every navigation, and the badge is on every page.
  const [reconciled, setReconciled] = useState(initialUnread);
  const [delta, setDelta] = useState(0);
  if (reconciled !== initialUnread) {
    setReconciled(initialUnread);
    setDelta(0);
  }
  const unread = Math.max(0, initialUnread + delta);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startAction] = useTransition();

  const open = useCallback(async (element: HTMLElement) => {
    setAnchor(element);
    setLoading(true);
    const rows = await loadNotificationsAction();
    setItems(rows);
    setLoading(false);
  }, []);

  // One subscription, on the shared browser client, so it rides the socket the
  // messages channel already opened.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Realtime authorises with the access token, and the browser client reads
    // its session from cookies asynchronously. Subscribing first opens the
    // socket unauthenticated and RLS drops every row.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`notifications:${viewerId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `profile_id=eq.${viewerId}`,
          },
          () => {
            setDelta((n) => n + 1);
            // Only refetch the list if somebody is looking at it.
            setItems((current) => {
              if (current) void loadNotificationsAction().then(setItems);
              return current;
            });
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [viewerId]);

  const close = () => setAnchor(null);

  const openItem = (item: Notification) => {
    close();
    if (!item.read) {
      setDelta((n) => n - 1);
      startAction(() => { void readOneAction(item.id); });
    }
    if (item.href) router.push(item.href);
  };

  const clearAll = () => {
    setDelta(-initialUnread);
    setItems((rows) => rows?.map((row) => ({ ...row, read: true })) ?? rows);
    startAction(() => { void readAllAction(); });
  };

  return (
    <>
      <IconButton
        aria-label={unread ? `${unread} notifications` : "Notifications"}
        onClick={(event) => void open(event.currentTarget)}
        sx={{ color: tokens.ink }}
      >
        <Badge badgeContent={unread} max={99}
          slotProps={{ badge: { sx: { backgroundColor: tokens.danger, color: "#fff",
                                      fontFamily: mono, fontWeight: 700 } } }}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}
        slotProps={{ paper: { sx: { width: 360, maxWidth: "calc(100vw - 24px)", mt: 1 } } }}>
        <Stack direction="row" spacing={1}
          sx={{ px: 2, py: 1.25, alignItems: "center" }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                            letterSpacing: "0.12em", color: tokens.inkMuted, flex: 1 }}>
            NOTIFICATIONS
          </Typography>
          {unread ? (
            <Button size="small" variant="text" onClick={clearAll}
              sx={{ minWidth: 0, fontSize: "0.78rem" }}>
              Mark all read
            </Button>
          ) : null}
        </Stack>
        <Divider />

        {loading && !items ? (
          <Stack sx={{ alignItems: "center", py: 4 }}>
            <CircularProgress size={22} sx={{ color: tokens.brass }} />
          </Stack>
        ) : items && items.length ? (
          <Box sx={{ maxHeight: 420, overflowY: "auto" }}>
            {items.map((item) => {
              const Icon = ICONS[item.kind] ?? NotificationsIcon;
              return (
                <MenuItem key={item.id} onClick={() => openItem(item)}
                  sx={{ alignItems: "flex-start", gap: 1.5, py: 1.25,
                        whiteSpace: "normal",
                        backgroundColor: item.read ? "transparent" : tokens.brassSoft }}>
                  <Box sx={{ width: 30, height: 30, borderRadius: 1, flexShrink: 0, mt: 0.25,
                             display: "grid", placeItems: "center",
                             backgroundColor: tokens.surface, color: tokens.brass }}>
                    <Icon sx={{ fontSize: 16 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: item.read ? 500 : 700 }}>
                      {item.title}
                    </Typography>
                    {item.body ? (
                      <Typography sx={{ fontSize: "0.8rem", color: tokens.inkMuted }}>
                        {item.body}
                      </Typography>
                    ) : null}
                    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                      letterSpacing: "0.06em", color: tokens.inkMuted }}>
                      {(sinceLabel(item.createdAt) ?? "").toUpperCase()}
                    </Typography>
                  </Box>
                </MenuItem>
              );
            })}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ px: 2, py: 4, color: tokens.inkMuted,
                                            textAlign: "center" }}>
            Nothing yet. Messages, club decisions and rivalries land here.
          </Typography>
        )}
      </Menu>
    </>
  );
}
