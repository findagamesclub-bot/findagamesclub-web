"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ShieldIcon from "@mui/icons-material/ShieldOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { useActionToast } from "@/components/ui/Toaster";
import { chooseConsentAction, type ConsentState } from "@/app/consent-actions";
import type { Consent } from "@/utils/consent";
import { display, tokens } from "@/lib/tokens";

/**
 * The choice, before anything optional runs.
 *
 * Rendered only when no choice has been made, decided on the server, so there
 * is no flash of a banner for somebody who answered months ago.
 *
 * Two buttons and no third state. A banner with "manage preferences" leading to
 * a panel of categories is the pattern people have learned to dismiss without
 * reading, and there is exactly one optional category to choose about.
 *
 * It sits at the bottom and is not a modal: the page underneath stays usable,
 * because nothing on it is running that needed asking about yet.
 */
export default function CookieBanner({ text }: { text: string }) {
  const [state, submit, pending] = useActionState<ConsentState, FormData>(
    chooseConsentAction, {});
  useActionToast(state);

  // Which button was pressed, so the spinner goes on that one rather than on
  // both. `pending` alone cannot tell them apart.
  const [pressed, setPressed] = useState<Consent | null>(null);

  // Derived, not held in state: the banner is gone exactly when a choice was
  // recorded. A failed write leaves it up with the toast explaining why,
  // because a banner that vanishes without saving is a consent nobody gave.
  // Returning null does not unmount, so the toast still fires.
  if (state.notice) return null;

  return (
    <Box
      role="region"
      aria-label="Cookie choices"
      sx={{
        position: "fixed", insetInline: 0, bottom: 0, zIndex: 1250,
        p: { xs: 1.5, sm: 2 },
        // Room for a phone's home indicator, so the buttons are not under it.
        pb: { xs: "calc(12px + env(safe-area-inset-bottom))", sm: 2 },
      }}
    >
      <Box sx={{
        maxWidth: 1000, mx: "auto",
        border: `1px solid ${tokens.rule}`, borderRadius: 1,
        backgroundColor: tokens.paper,
        boxShadow: "0 -2px 18px rgba(16, 27, 45, 0.12)",
        p: { xs: 2, sm: 2.5 },
      }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 2, md: 3 }}
          sx={{ alignItems: { md: "center" } }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h2" sx={{
              fontFamily: display, fontWeight: 700, fontSize: "1rem", mb: 0.5,
            }}>
              Cookies on FindAGamesClub
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", lineHeight: 1.6, color: tokens.inkMuted }}>
              {text}{" "}
              <Box component={NextLink} href="/privacy-policy"
                sx={{ color: tokens.brand, textUnderlineOffset: "2px" }}>
                Read our privacy policy
              </Box>
            </Typography>
          </Box>

          {/* Equal weight on purpose. Making "Accept all" the only button that
              looks like a button is the dark pattern this is meant to avoid. */}
          <Stack component="form" action={submit}
            direction={{ xs: "column", sm: "row" }} spacing={1.5}
            sx={{ flexShrink: 0, width: { xs: "100%", md: "auto" } }}>
            <Button type="submit" name="choice" value="necessary"
              variant="outlined" disabled={pending}
              loading={pending && pressed === "necessary"} loadingPosition="start"
              startIcon={<ShieldIcon />}
              onClick={() => setPressed("necessary")}
              sx={{ minWidth: 168 }}>
              Necessary only
            </Button>
            <Button type="submit" name="choice" value="all"
              variant="contained" disabled={pending}
              loading={pending && pressed === "all"} loadingPosition="start"
              startIcon={<CheckIcon />}
              onClick={() => setPressed("all")}
              sx={{ minWidth: 168 }}>
              Accept all
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
