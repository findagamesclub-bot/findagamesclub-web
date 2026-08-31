"use server";

import { reverseGeocodeUk } from "@/services/geocode.service";

export type LocatedPlace =
  | { ok: true; place: string; town: string | null }
  | { ok: false; error: string };

/**
 * Where the browser says somebody is, as a place the directory can search.
 *
 * Done on the server so the lookup goes through the same geocoder, cache and
 * timeout as every other place, rather than a second one in the browser.
 */
export async function locatePlace(
  latitude: number,
  longitude: number,
): Promise<LocatedPlace> {
  try {
    const found = await reverseGeocodeUk(latitude, longitude);
    if (!found) {
      return { ok: false, error: "We could not match that to a UK postcode area." };
    }
    return { ok: true, place: found.district, town: found.town };
  } catch {
    return { ok: false, error: "Could not look that up just now. Try typing a town instead." };
  }
}
