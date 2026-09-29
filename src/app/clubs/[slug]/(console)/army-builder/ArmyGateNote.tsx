import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { tokens } from "@/lib/tokens";

/**
 * Why somebody cannot build here, said out loud.
 *
 * Never a hidden feature. A member on Basic who cannot see that the builder
 * exists has no way to learn what a paid tier would give them, which is the
 * same call the ticket desk makes about a members-only ticket.
 */
export default function ArmyGateNote({ reason }: { reason: string }) {
  return (
    <Stack direction="row" spacing={1.5}
      sx={{ alignItems: "flex-start", p: 2, borderRadius: 1.5,
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <LockOutlinedIcon sx={{ fontSize: 20, color: tokens.inkMuted, mt: 0.2 }} />
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {reason}
      </Typography>
    </Stack>
  );
}
