"use client";

import Box from "@mui/material/Box";
import SubmitButton from "@/components/ui/SubmitButton";
import { startListingAction } from "@/app/list-your-club/actions";

/**
 * Start a listing.
 *
 * A form rather than a link, because starting one writes a row. A GET that
 * creates something is a row per refresh and a row per link preview.
 */
export default function StartListingButton({
  label = "Start your listing", variant = "contained",
}: {
  label?: string;
  variant?: "contained" | "outlined";
}) {
  return (
    <Box component="form" action={startListingAction} sx={{ alignSelf: "flex-start" }}>
      <SubmitButton label={label} pendingLabel="Starting your listing"
        variant={variant} size="large" />
    </Box>
  );
}
