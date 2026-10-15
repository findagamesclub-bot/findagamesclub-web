"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { unitShapeProblem } from "@/utils/unit-shape";
import {
  addDispositions, getDetachmentUsage, newDraft, publish, removeDetachment,
  removeUnit, saveDetachment, saveFaction, saveUnit,
  type DetachmentUsage,
} from "@/services/armyCatalogue.service";

export type CatalogueState = { error?: string; notice?: string };

const num = (data: FormData, key: string) => Number(data.get(key) ?? 0) || 0;
const str = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

/**
 * Every write to the catalogue, through one action.
 *
 * Checked here and again in `army_catalogue_writable`, which is the one that
 * counts: it re-reads whether the version is published rather than trusting
 * anything on the form, so a stale tab cannot edit a frozen catalogue.
 */
export async function catalogueAction(
  _prev: CatalogueState, data: FormData,
): Promise<CatalogueState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only a site admin can change the catalogue." };
  }

  const edition = str(data, "edition");
  const intent = str(data, "intent");
  if (!edition) return { error: "Something went wrong. Reload and try again." };

  const refresh = () => {
    revalidatePath("/admin/catalogue");
    revalidatePath("/admin/catalogue/[factionId]", "page");
  };

  if (intent === "faction") {
    const done = await saveFaction({
      edition, id: str(data, "id"), label: str(data, "label"),
      position: num(data, "position"),
    });
    refresh();
    return done.ok ? { notice: done.notice } : { error: done.error };
  }

  if (intent === "detachment") {
    const done = await saveDetachment({
      edition, faction: str(data, "faction"), slug: str(data, "slug"),
      label: str(data, "label"),
      // One per line, which is how somebody types a short list. Blank lines
      // drop out rather than becoming a disposition called nothing.
      dispositions: str(data, "dispositions").split("\n")
        .map((one) => one.trim()).filter(Boolean),
      position: num(data, "position"),
    });
    refresh();
    return done.ok ? { notice: done.notice } : { error: done.error };
  }

  if (intent === "unit") {
    let options: unknown[] = [];
    let rules: unknown[] = [];
    try {
      options = JSON.parse(str(data, "options") || "[]");
      rules = JSON.parse(str(data, "rules") || "[]");
    } catch {
      return { error: "The options or the copy costs are not valid JSON." };
    }

    // Parsing is not checking. Copy-cost rules pasted into the options box are
    // valid JSON and the wrong thing entirely, and they saved without a word
    // and then priced every copy at the base points. The screen says this too;
    // this is the half that holds whatever sent the request.
    const problem = unitShapeProblem(options, rules);
    if (problem) return { error: problem };

    const done = await saveUnit({
      edition, faction: str(data, "faction"), name: str(data, "name"),
      points: num(data, "points"), options, rules, position: num(data, "position"),
    });
    refresh();
    return done.ok ? { notice: done.notice } : { error: done.error };
  }

  if (intent === "remove-detachment") {
    const done = await removeDetachment(edition, num(data, "detachment"));
    refresh();
    return done.ok ? { notice: done.notice } : { error: done.error };
  }

  if (intent === "faction-dispositions") {
    const done = await addDispositions({
      edition, faction: str(data, "faction"),
      // One per line, the same reading the detachment dialog's own box gets.
      dispositions: str(data, "dispositions").split("\n")
        .map((one) => one.trim()).filter(Boolean),
    });
    refresh();
    return done.ok ? { notice: done.notice } : { error: done.error };
  }

  if (intent === "remove-unit") {
    const done = await removeUnit(edition, num(data, "unit"));
    refresh();
    return done.ok ? { notice: done.notice } : { error: done.error };
  }

  if (intent === "publish") {
    const done = await publish(edition, str(data, "note"));
    refresh();
    return done.ok ? { notice: done.notice } : { error: done.error };
  }

  if (intent === "draft") {
    const done = await newDraft(edition, str(data, "version"));
    refresh();
    return done.ok ? { notice: done.notice } : { error: done.error };
  }

  return { error: "That is not something you can do to the catalogue." };
}

/**
 * What names a detachment, read when somebody opens the confirm.
 *
 * Its own action rather than a branch of the one above, because this answers
 * rather than writes: folding it into `CatalogueState` would mean a read
 * landing in the slot a refusal is meant to occupy, and a toast firing on a
 * count nobody asked to be told.
 *
 * Not folded into the faction's own read either. It walks every club's results
 * and army lists, so a page of 24 detachments would pay for it 24 times over
 * to draw nothing.
 */
export async function detachmentUsageAction(
  edition: string, detachment: number,
): Promise<DetachmentUsage | null> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") return null;
  return getDetachmentUsage(edition, detachment);
}
