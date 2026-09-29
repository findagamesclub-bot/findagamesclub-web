"use client";

import { useMemo, useState } from "react";
import { normaliseLines, type DraftLine, type NormalisedList } from "@/utils/army-list";
import { unitsFor, type Catalogue } from "@/utils/army-catalogue";
import type { PricedUnit } from "@/utils/army-pricing";
import { fold } from "@/utils/text";

export type Detachment = { detachment: string; disposition: string };

export type ArmyDraft = {
  listId: number | null;
  name: string;
  listType: "army-list" | "collection";
  pointsLimit: string;
  factionId: string;
  detachments: Detachment[];
  units: DraftLine[];
};

const keyOf = (name: string, option: string) => `${fold(name)}::${fold(option)}`;

/**
 * The draft a wizard step edits, kept merged and priced.
 *
 * Merged on the way in rather than at the end: adding the same unit and option
 * twice moves a number instead of growing a second row, which is what the
 * screen shows anyway. `normaliseLines` then re-prices on every change, which
 * is what lets the points bar stay honest without a round trip.
 */
export function useArmyDraft(start: ArmyDraft, catalogue: Catalogue | null) {
  const [draft, setDraft] = useState<ArmyDraft>(start);

  const units: PricedUnit[] = useMemo(
    () => unitsFor(catalogue, draft.factionId), [catalogue, draft.factionId]);

  const priced: NormalisedList = useMemo(
    () => normaliseLines(units, draft.units), [units, draft.units]);

  /** How many of each unit are in the list, for the picker's next-copy price. */
  const held = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of priced.lines) {
      map.set(fold(line.unitName), (map.get(fold(line.unitName)) ?? 0) + line.quantity);
    }
    return map;
  }, [priced.lines]);

  const patch = (next: Partial<ArmyDraft>) =>
    setDraft((current) => ({ ...current, ...next }));

  const addUnit = (unit: PricedUnit, optionLabel: string) =>
    setDraft((current) => {
      const key = keyOf(unit.name, optionLabel);
      const found = current.units.find(
        (one) => keyOf(one.unitName, one.optionLabel ?? "") === key);
      return {
        ...current,
        units: found
          ? current.units.map((one) =>
              one === found ? { ...one, quantity: one.quantity + 1 } : one)
          : [...current.units, { unitName: unit.name, optionLabel, quantity: 1 }],
      };
    });

  const setQuantity = (unitName: string, optionLabel: string, next: number) =>
    setDraft((current) => {
      const key = keyOf(unitName, optionLabel);
      const matches = (one: DraftLine) => keyOf(one.unitName, one.optionLabel ?? "") === key;
      return {
        ...current,
        units: next <= 0
          ? current.units.filter((one) => !matches(one))
          : current.units.map((one) => matches(one) ? { ...one, quantity: next } : one),
      };
    });

  /** Changing faction takes its units and detachments with it. */
  const setFaction = (factionId: string) =>
    patch({ factionId, detachments: [], units: [] });

  return { draft, units, priced, held, patch, addUnit, setQuantity, setFaction };
}
