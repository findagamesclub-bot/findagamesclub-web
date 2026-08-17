import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

/** Says what happened and what to do. Never "an error occurred". */
export default function ErrorState({ message, retryHref }: { message: string; retryHref?: string }) {
  return (
    <Box sx={{ py: 6, textAlign: "center" }}>
      <Stack spacing={1.5} sx={{ alignItems: "center", maxWidth: 420, mx: "auto" }}>
        <Typography variant="h4" component="p">That did not load</Typography>
        <Typography variant="body2" color="text.secondary">{message}</Typography>
        {retryHref ? (
          <Button href={retryHref} variant="outlined" sx={{ mt: 1 }}>Try again</Button>
        ) : null}
      </Stack>
    </Box>
  );
}
