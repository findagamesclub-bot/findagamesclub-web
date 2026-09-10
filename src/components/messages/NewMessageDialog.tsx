"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import BusyOverlay from "@/components/ui/BusyOverlay";
import { byClub, searchContacts } from "@/utils/message-rail";
import { initials } from "@/utils/initials";
import Avatar from "@mui/material/Avatar";
import { mono, tokens } from "@/lib/tokens";
import type { Contact } from "@/types/message";

/**
 * Pick somebody to write to.
 *
 * The rail used to list every member of every club you belong to, which is
 * unusable once a club has more than a screenful. Choosing a person is a
 * search, grouped by the club you share, because that is how you know them.
 */
export default function NewMessageDialog({
  contacts, open, onClose, base = "/account/messages",
  emptyHint = "Join a club and its members appear here.",
  onSearch, searchLabel = "Search by name or club",
}: {
  /** Where these conversations live. */
  base?: string;
  /**
   * What to say when there is nobody to message. The member area tells them to
   * join a club; the admin console cannot, because joining one is not what an
   * admin is there to do.
   */
  emptyHint?: string;
  contacts: Contact[];
  open: boolean;
  onClose: () => void;
  /**
   * Asks the server who matches instead of filtering the list.
   *
   * A member's contacts are the people they share a club with, which is a
   * short list worth holding. An admin's are every account on the site, which
   * is not, so theirs is a query.
   */
  onSearch?: (query: string) => Promise<Contact[]>;
  searchLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [found_, setFound] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced, because this one goes to the server on every keystroke
  // otherwise. Only runs when a search function was supplied.
  useEffect(() => {
    if (!onSearch || !open) return;
    let live = true;
    setSearching(true);
    const id = setTimeout(async () => {
      const rows = await onSearch(query).catch(() => []);
      if (live) { setFound(rows); setSearching(false); }
    }, 250);
    return () => { live = false; clearTimeout(id); };
  }, [onSearch, open, query]);

  const pool = onSearch ? found_ : contacts;
  // Grouped by club when the people share one, which is how a member knows
  // them. One flat list when searching every account, because nobody shares a
  // club with an admin and grouping would put each person under their own
  // heading with a gap between every row.
  const groups = useMemo(
    () => (onSearch
      ? (pool.length ? [{ clubName: "", people: pool }] : [])
      : byClub(searchContacts(pool, query))),
    [onSearch, pool, query],
  );
  const found = groups.reduce((n, group) => n + group.people.length, 0);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 2 } } }}>
      <DialogTitle sx={{ pr: 6, fontSize: "1.25rem" }}>
        New message
        <IconButton onClick={onClose} aria-label="Close"
          sx={{ position: "absolute", right: 12, top: 12, color: tokens.inkMuted }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        <TextField
          autoFocus fullWidth size="medium" placeholder={searchLabel}
          value={query} onChange={(event) => setQuery(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: tokens.inkMuted }} />
                </InputAdornment>
              ),
            },
          }}
        />

        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", letterSpacing: "0.1em",
                          color: tokens.inkMuted, mt: 1.75, mb: 0.5 }}>
          {onSearch
            ? `${found} ${found === 1 ? "ACCOUNT" : "ACCOUNTS"}`
            : found === contacts.length
              ? `${found} PEOPLE YOU SHARE A CLUB WITH`
              : `${found} OF ${contacts.length}`}
        </Typography>

        <BusyOverlay busy={searching} variant="dim" label="Searching accounts">
        <Box sx={{ maxHeight: 380, minHeight: searching ? 120 : undefined,
                   overflowY: "auto", mx: -1, px: 1 }}>
          {groups.map((group) => (
            <Box key={group.clubName} sx={{ mb: 1.5 }}>
              {/* A heading per club is how you know somebody. Searching every
                  account, nobody shares a club, so the heading would be one
                  per person and the list would be all headings. */}
              {onSearch ? null : (
                <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                  letterSpacing: "0.1em", color: tokens.brass,
                                  py: 0.75, position: "sticky", top: 0, zIndex: 1,
                                  backgroundColor: tokens.paper }}>
                  {group.clubName.toUpperCase()}
                </Typography>
              )}

              {group.people.map((person) => (
                <NextLink key={`${person.clubId}:${person.personId}`}
                  href={`${base}/${person.clubId}/${person.personId}`}
                  onClick={onClose}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <Stack direction="row" spacing={1.5}
                    sx={{ alignItems: "center", px: 1, py: 1, borderRadius: 1.5,
                          "&:hover": { backgroundColor: tokens.surface } }}>
                    <Avatar sx={{ width: 34, height: 34, fontSize: "0.8rem",
                                  bgcolor: tokens.brassSoft, color: "#5c4310",
                                  fontWeight: 700 }}>
                      {initials(person.personName)}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {person.personName}
                      </Typography>
                      {/* Two members can share a name, and an admin writing
                          about somebody's account has to have the right one. */}
                      {onSearch ? (
                        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                          color: tokens.inkMuted, overflowWrap: "anywhere" }}>
                          {person.clubName}
                        </Typography>
                      ) : null}
                    </Box>
                  </Stack>
                </NextLink>
              ))}
            </Box>
          ))}

          {/* Nothing to say while the answer is still coming: the spinner is
              already saying it, and "nobody matches" would be wrong. */}
          {!found && !searching ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
              {onSearch
                ? query
                  ? `No account matching "${query}".`
                  : emptyHint
                : contacts.length
                  ? `Nobody matching "${query}". You can only message people you share a club with.`
                  : emptyHint}
            </Typography>
          ) : null}
        </Box>
        </BusyOverlay>
      </DialogContent>
    </Dialog>
  );
}
