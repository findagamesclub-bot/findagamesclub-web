"use client";

import { useMemo, useState } from "react";
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
  contacts, open, onClose,
}: {
  contacts: Contact[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => byClub(searchContacts(contacts, query)), [contacts, query]);
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
          autoFocus fullWidth size="medium" placeholder="Search by name or club"
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
          {found === contacts.length
            ? `${found} PEOPLE YOU SHARE A CLUB WITH`
            : `${found} OF ${contacts.length}`}
        </Typography>

        <Box sx={{ maxHeight: 380, overflowY: "auto", mx: -1, px: 1 }}>
          {groups.map((group) => (
            <Box key={group.clubName} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.brass,
                                py: 0.75, position: "sticky", top: 0,
                                backgroundColor: tokens.paper }}>
                {group.clubName.toUpperCase()}
              </Typography>

              {group.people.map((person) => (
                <NextLink key={`${person.clubId}:${person.personId}`}
                  href={`/account/messages/${person.clubId}/${person.personId}`}
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
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {person.personName}
                    </Typography>
                  </Stack>
                </NextLink>
              ))}
            </Box>
          ))}

          {!found ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
              {contacts.length
                ? `Nobody matching "${query}". You can only message people you share a club with.`
                : "Join a club and its members appear here."}
            </Typography>
          ) : null}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
