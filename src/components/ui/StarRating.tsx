import Box from "@mui/material/Box";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

type Props = {
  value: number;
  /** Shown beside the stars, e.g. "4.8 from 12". Omit for a bare row of stars. */
  caption?: string;
  size?: "small" | "medium";
};

/** Brass stars. The ★/☆ characters this replaced rendered at different widths per font. */
export default function StarRating({ value, caption, size = "small" }: Props) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.875 }}>
      <Rating
        value={value}
        precision={0.5}
        readOnly
        size={size}
        sx={{ color: tokens.brass, "& .MuiRating-iconEmpty": { color: "#D9E1EB" } }}
      />
      {caption ? (
        <Typography component="span" sx={{ fontFamily: mono, fontSize: "0.85rem", color: "text.secondary" }}>
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}
