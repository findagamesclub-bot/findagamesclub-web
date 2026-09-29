"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";
import type { UnitRow } from "@/services/armyCatalogue.service";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * One page of a faction's units.
 *
 * Paged and searched in SQL by the page above: 1409 units across the catalogue
 * and a couple of hundred in one faction is the thousand-row case, and nothing
 * sorts them in the browser.
 */
export default function UnitGrid({
  units, failed, query, frozen, onEdit, onRemove,
}: {
  units: UnitRow[];
  failed: boolean;
  query: string;
  frozen: boolean;
  onEdit: (unit: UnitRow) => void;
  onRemove: (unit: UnitRow) => void;
}) {
  return (
    <>
            {failed ? (
              <EmptyState title="The units would not load"
                description="Nothing was read, so this is not an empty faction. Check the latest migrations have been run." />
            ) : units.length === 0 ? (
              <EmptyState
                title={query ? "No unit matches that" : "No units yet"}
                description={query
                  ? "Try a shorter word, or clear the search to see every unit."
                  : "Import the legacy catalogue, or add them one at a time."}
              />
            ) : (
              <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                         gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                                sm: "repeat(2, minmax(0, 1fr))",
                                                lg: "repeat(3, minmax(0, 1fr))" } }}>
                {units.map((unit) => (
                  <Stack key={unit.id} spacing={1}
                    sx={{ height: "100%", p: 2, borderRadius: 1.5,
                          border: `1px solid ${tokens.rule}`,
                          backgroundColor: tokens.paper }}>
                    <Typography sx={{ fontFamily: display, fontWeight: 700,
                                      fontSize: "0.98rem" }}>
                      {unit.name}
                    </Typography>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
                      <Typography sx={{ fontFamily: mono, fontSize: "1.05rem",
                                        fontWeight: 700, color: tokens.brass,
                                        lineHeight: 1 }}>
                        {unit.base_points}
                      </Typography>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                        color: tokens.inkMuted }}>
                        points
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} useFlexGap
                      sx={{ flexWrap: "wrap" }}>
                      {(unit.options?.length ?? 0) > 0 ? (
                        <StatusChip marker
                          label={`${unit.options.length} ${unit.options.length === 1 ? "option" : "options"}`} />
                      ) : null}
                      {/* The rule that makes three Castigators 505 and not
                          495. Worth saying on the card, because it is the one
                          thing about a unit that is easy to lose. */}
                      {(unit.copy_cost_rules?.length ?? 0) > 0 ? (
                        <StatusChip marker label="Copy costs" />
                      ) : null}
                    </Stack>

                    <Box sx={{ flex: 1 }} />
                    {frozen ? null : (
                      <Stack direction="row" spacing={0.5}
                        sx={{ pt: 1.25, borderTop: `1px solid ${tokens.rule}`,
                              justifyContent: "flex-end" }}>
                        <Button variant="text" size="small"
                          onClick={() => onRemove(unit)}
                          sx={{ color: tokens.danger }}>
                          Remove
                        </Button>
                        <Button variant="outlined" size="small"
                          onClick={() => onEdit(unit)}>
                          Edit
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                ))}
              </Box>
            )}
    </>
  );
}
