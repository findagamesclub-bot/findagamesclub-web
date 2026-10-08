"use client";

import { startTransition, useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { billingAction, type BillingState } from
  "@/app/clubs/[slug]/(console)/manage/billing/actions";
import { pricePence } from "@/utils/format";
import { mono, tokens } from "@/lib/tokens";

type Interval = "monthly" | "yearly";

/**
 * Monthly or yearly, chosen by the club.
 *
 * `club_submissions.plan_interval` has decided this since 0112 and no screen
 * could set it, so every listing became monthly and the yearly price was
 * advertised on the marketing page and unreachable. This is the owner's way in.
 *
 * Two cards rather than a select, and the saving said in the same words the
 * club's own membership tiers use ("SAVE £30", "works out at £12.50 a month").
 * An owner reads that phrasing on their own pricing page; a second way of
 * saying the same arithmetic is one more thing to work out.
 */
export default function PlanPicker({
  slug, current, monthlyPence, yearlyPence, currency, renewsOn,
}: {
  slug: string;
  current: Interval;
  monthlyPence: number;
  yearlyPence: number;
  currency: string;
  /** When the change lands, which is the whole reason it is not instant. */
  renewsOn: string | null;
}) {
  const [state, submit, busy] =
    useActionState<BillingState, FormData>(billingAction, {});
  useActionToast(state);
  const [picked, setPicked] = useState<Interval>(current);

  // Twelve months at the monthly price against the yearly one. Shown only when
  // it is a real saving, because "SAVE £0" is the page inventing a reason.
  const saved = monthlyPence * 12 - yearlyPence;
  const perMonth = yearlyPence / 12;

  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  };

  const options: { value: Interval; headline: string; under: string | null }[] = [
    {
      value: "monthly",
      headline: `${pricePence(monthlyPence, currency)} a month`,
      under: null,
    },
    {
      value: "yearly",
      headline: `${pricePence(yearlyPence, currency)} a year`,
      under: yearlyPence > 0
        ? `Works out at ${pricePence(perMonth, currency)} a month.`
        : null,
    },
  ];

  return (
    <Box component="form" onSubmit={send}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="intent" value="plan" />
      <input type="hidden" name="plan" value={picked} />

      <Stack spacing={2}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {renewsOn
            ? `A change takes effect when your listing renews on ${renewsOn}, so you are never charged twice for the same days.`
            : "A change takes effect at your next renewal, so you are never charged twice for the same days."}
        </Typography>

        <Box role="radiogroup" aria-label="Billing plan" sx={{
          display: "grid", gap: 1.5,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
        }}>
          {options.map((option) => {
            const chosen = picked === option.value;
            return (
              <Box
                key={option.value}
                component="button"
                type="button"
                role="radio"
                aria-checked={chosen}
                onClick={() => setPicked(option.value)}
                sx={{
                  textAlign: "left", cursor: "pointer", width: "100%",
                  py: 1.75, borderRadius: 1.5,
                  backgroundColor: chosen ? tokens.surface : tokens.paper,
                  border: `${chosen ? 2 : 1}px solid ${chosen ? tokens.brand : tokens.rule}`,
                  // The border thickens on selection, so the padding gives the
                  // extra pixel back and the card does not jump a row.
                  px: chosen ? "13px" : "14px",
                  transition: "border-color 140ms ease",
                  "&:hover": { borderColor: chosen ? tokens.brand : tokens.inkMuted },
                  "&:focus-visible": { outline: `2px solid ${tokens.brand}`, outlineOffset: 2 },
                }}
              >
                <Stack spacing={0.4}>
                  <Stack direction="row" spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                      fontWeight: 700, letterSpacing: "0.1em",
                                      color: chosen ? tokens.brand : tokens.inkMuted }}>
                      {option.value === "yearly" ? "YEARLY" : "MONTHLY"}
                    </Typography>
                    {option.value === "yearly" && saved > 0 ? (
                      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                        fontWeight: 700, letterSpacing: "0.1em",
                                        color: tokens.brass }}>
                        {`SAVE ${pricePence(saved, currency)}`}
                      </Typography>
                    ) : null}
                  </Stack>

                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    {option.headline}
                  </Typography>

                  {option.under ? (
                    <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                      {option.under}
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
            );
          })}
        </Box>

        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
          <SubmitButton label="Save your plan" pendingLabel="Saving"
            pending={busy} blocked={picked === current} />
        </Stack>
      </Stack>
    </Box>
  );
}
