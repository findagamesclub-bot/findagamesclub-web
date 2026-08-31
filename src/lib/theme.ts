"use client";

import { createTheme } from "@mui/material/styles";
import { tokens, mono, display, body } from "./tokens";

export { tokens, mono } from "./tokens";

/**
 * Design tokens and MUI theme. The listing borrows the wargaming datasheet its
 * audience already reads: condensed labels, serif body, mono figures, hairlines.
 * Brass is for data emphasis only — decorative use makes it generic.
 */



const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: tokens.brand, dark: tokens.brandDeep, light: "#4D84BD", contrastText: "#FFFFFF" },
    secondary: { main: tokens.brass, light: tokens.brassSoft, contrastText: "#241A05" },
    success: { main: tokens.positive },
    error: { main: tokens.danger },
    background: { default: tokens.surface, paper: tokens.paper },
    text: { primary: tokens.ink, secondary: tokens.inkMuted },
    divider: tokens.rule,
  },

  shape: { borderRadius: 6 },

  typography: {
    fontFamily: body,

    h1: {
      fontFamily: display,
      fontSize: "clamp(2.6rem, 6vw, 4rem)",
      fontWeight: 700,
      lineHeight: 1.04,
      letterSpacing: "-0.025em",
    },
    h2: {
      fontFamily: display,
      fontSize: "clamp(1.95rem, 4vw, 2.7rem)",
      fontWeight: 700,
      lineHeight: 1.12,
      letterSpacing: "-0.02em",
    },
    h3: { fontFamily: display, fontSize: "1.625rem", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.015em" },
    h4: { fontFamily: display, fontSize: "1.35rem", fontWeight: 600, lineHeight: 1.25 },
    h5: { fontFamily: display, fontSize: "1.15rem", fontWeight: 600 },
    h6: { fontFamily: display, fontSize: "1.05rem", fontWeight: 600 },

    // Well above MUI's default. It's a serif reading face, and the client
    // found the first pass too small to scan comfortably.
    body1: { fontFamily: body, fontSize: "1.1875rem", lineHeight: 1.6 },
    body2: { fontFamily: body, fontSize: "1.0625rem", lineHeight: 1.55 },

    // Eyebrow and stat labels.
    overline: {
      fontFamily: display,
      fontSize: "0.78rem",
      fontWeight: 600,
      letterSpacing: "0.13em",
      textTransform: "uppercase",
      lineHeight: 1.4,
      fontStretch: "87.5%",
    },
    subtitle1: { fontFamily: display, fontSize: "1.125rem", fontWeight: 500 },
    subtitle2: { fontFamily: display, fontSize: "0.975rem", fontWeight: 600 },
    caption: { fontFamily: display, fontSize: "0.9rem", lineHeight: 1.45 },
    button: { fontFamily: display, fontSize: "1rem", fontWeight: 600, textTransform: "none", letterSpacing: 0 },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Tabular figures so stat columns line up.
        "code, kbd, samp, .mono": { fontFamily: mono, fontVariantNumeric: "tabular-nums" },
        "::selection": { background: tokens.brandSoft, color: tokens.ink },
        // next/link renders a bare <a>, which otherwise picks up the browser's
        // default blue and full underline and reads as an unstyled page.
        "a": {
          color: tokens.brand,
          textDecorationColor: "rgba(23,75,138,0.35)",
          textUnderlineOffset: "3px",
        },
        "a:hover": { textDecorationColor: tokens.brand },
        "*:focus-visible": { outline: `2px solid ${tokens.brand}`, outlineOffset: "2px" },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 4,
          paddingInline: "1.1rem",
          // A button is as wide as its label. Wrapping "Create account" onto two
          // lines to fit a tight header is never the right trade.
          whiteSpace: "nowrap",
          "&.MuiButton-containedPrimary:hover": { backgroundColor: tokens.brandDeep },
          // MUI puts a spinner in the start-icon slot, which carries an 8px
          // gap meant for a real icon. An icon is part of the label's meaning
          // and earns that space; a spinner is a state marker beside it and
          // reads as detached at the same distance. Scoped to the loading
          // state so ordinary start icons keep their spacing.
          "&.MuiButton-loading .MuiButton-startIcon": { marginRight: 4, marginLeft: -1 },
        },
        sizeLarge: { paddingBlock: "0.65rem", paddingInline: "1.5rem", fontSize: "1rem" },
        outlined: { borderColor: tokens.rule, "&:hover": { borderColor: tokens.brand, background: "transparent" } },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.rule}`,
          background: tokens.paper,
          transition: "border-color 120ms ease, box-shadow 120ms ease",
          "&:hover": { borderColor: "#B9C8DC", boxShadow: "0 1px 2px rgba(16,27,45,0.06)" },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontFamily: display, fontWeight: 500, borderRadius: 3 },
        outlined: { borderColor: tokens.rule },
        sizeSmall: { fontSize: "0.75rem", height: 24 },
      },
    },

    MuiTextField: { defaultProps: { variant: "outlined", size: "small" } },

    // Controls take the display face, not the serif. The serif is a reading
    // face for prose — on a select it reads like body copy that has wandered
    // into the form, and it made the filter panel look unfinished.
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 4, background: tokens.paper, fontFamily: display, fontSize: "1rem" },
        notchedOutline: { borderColor: tokens.rule },
      },
    },

    /**
     * The floating label and the notch it sits in are measured two different
     * ways by MUI: the label is shrunk with `transform: scale(0.75)`, while the
     * legend that cuts the notch is sized with `font-size: 0.75em`. Type does
     * not render linearly under scaling, so in Archivo those disagree — 1.9px
     * on "Playing with", 25.7px on "Why Gulnabi is not joining (optional)" —
     * and the label ends up sitting on the border it is supposed to sit inside.
     *
     * Shrinking by font-size instead makes the label measure at exactly the
     * 0.75rem the legend already uses, so the two agree at any length.
     */
    MuiInputLabel: {
      styleOverrides: {
        root: { fontFamily: display },
        shrink: { transform: "translate(14px, -9px) scale(1)", fontSize: "0.75rem" },
      },
    },
    MuiMenuItem: { styleOverrides: { root: { fontFamily: display, fontSize: "1rem" } } },
    MuiFormHelperText: { styleOverrides: { root: { fontFamily: display } } },
    MuiFormControlLabel: { styleOverrides: { label: { fontFamily: display } } },

    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit", position: "sticky" },
      styleOverrides: {
        root: { borderBottom: `1px solid ${tokens.rule}`, backgroundImage: "none", background: tokens.paper },
      },
    },

    MuiLink: {
      defaultProps: { underline: "hover" },
      styleOverrides: { root: { fontFamily: "inherit", textUnderlineOffset: "0.15em" } },
    },

    // Figures, so 9 and 10 sit the same width apart and the row does not
    // shuffle sideways as you page through it.
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          fontFamily: display,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
          borderColor: tokens.rule,
          color: tokens.ink,
          minWidth: 36,
          height: 36,
          transition: "background-color 120ms ease, border-color 120ms ease",
          "&:hover": { backgroundColor: tokens.brandSoft },
          "&.Mui-selected": {
            backgroundColor: tokens.brand,
            color: "#FFFFFF",
            fontWeight: 700,
            "&:hover": { backgroundColor: tokens.brandDeep },
          },
        },
        ellipsis: { color: tokens.inkMuted, height: 36, lineHeight: "36px" },
      },
    },

    MuiDivider: { styleOverrides: { root: { borderColor: tokens.rule } } },

    MuiSkeleton: { defaultProps: { animation: "wave" }, styleOverrides: { root: { backgroundColor: "#E9EFF6" } } },
  },
});

export default theme;
