"use client";

import { createTheme } from "@mui/material/styles";

/**
 * Single light theme. Brand palette carried over from the existing
 * FindAGamesClub frontend (clubs-v2/styles.css) so the rebuild stays
 * recognisable:
 *   accent #174b8a · accent-deep #0e2f57 · accent-soft #dcecff · ink #10223f
 */
const brand = {
  50: "#eef5ff",
  100: "#dcecff",
  200: "#bfd2eb",
  300: "#8fb4dd",
  400: "#4d84bd",
  500: "#174b8a",
  600: "#123a69",
  700: "#0e2f57",
  800: "#0b2442",
  900: "#10223f",
} as const;

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: brand[500], dark: brand[700], light: brand[300], contrastText: "#ffffff" },
    secondary: { main: "#b8862b", contrastText: "#ffffff" },
    background: { default: "#f8fbff", paper: "#ffffff" },
    text: { primary: brand[900], secondary: "#4a5b73" },
    divider: "#dbe5f2",
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
    h1: { fontSize: "clamp(2.2rem, 5vw, 3.4rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
    h2: { fontSize: "clamp(1.7rem, 3.5vw, 2.4rem)", fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.2 },
    h3: { fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.01em" },
    h4: { fontSize: "1.25rem", fontWeight: 600 },
    h5: { fontSize: "1.05rem", fontWeight: 600 },
    h6: { fontSize: "0.95rem", fontWeight: 600 },
    subtitle2: { fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.75rem" },
    button: { fontWeight: 600, textTransform: "none", letterSpacing: 0 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: "1.25rem" },
        sizeLarge: { paddingBlock: "0.7rem", paddingInline: "1.75rem" },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme: t }) => ({
          border: `1px solid ${t.palette.divider}`,
          transition: "border-color 140ms ease, transform 140ms ease",
        }),
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500 } },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderBottom: `1px solid ${t.palette.divider}`,
          backgroundImage: "none",
        }),
      },
    },
    MuiLink: {
      defaultProps: { underline: "hover" },
    },
  },
});

export default theme;
