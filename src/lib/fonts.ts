import { Archivo, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";

/**
 * Three faces, one job each: Archivo for structure (variable width lets stat
 * labels compress), Source Serif for reading, Plex Mono for figures.
 */

export const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const sourceSerif = Source_Serif_4({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const fontVariables = `${archivo.variable} ${sourceSerif.variable} ${plexMono.variable}`;
