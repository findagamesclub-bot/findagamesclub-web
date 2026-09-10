"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Radio from "@mui/material/Radio";
import { INVITABLE_ROLES, ROLE_LABEL, ROLE_SUMMARY } from "@/utils/club-access";
import { display, tokens } from "@/lib/tokens";

/**
 * Manager or Helper, each with what it actually means.
 *
 * Cards rather than a select, because the difference between the two is the
 * whole decision and a dropdown hides it behind a click. The summary is the
 * same sentence the team list shows under each person, so somebody comparing
 * the two is reading one description, not two that might disagree.
 */
export default function RolePicker({
  name, value, onChange,
}: {
  name: string;
  value: string;
  onChange: (role: string) => void;
}) {
  return (
    <Stack spacing={1.25} role="radiogroup" aria-label="Role">
      {INVITABLE_ROLES.map((role) => {
        const on = value === role;
        return (
          <Box
            key={role}
            onClick={() => onChange(role)}
            sx={{ display: "flex", gap: 1, alignItems: "flex-start", cursor: "pointer",
                  px: 1.5, py: 1.25, borderRadius: 1.5,
                  border: `1px solid ${on ? tokens.brass : tokens.rule}`,
                  backgroundColor: on ? tokens.brassSoft : tokens.paper }}
          >
            <Radio
              checked={on}
              name={name}
              value={role}
              onChange={() => onChange(role)}
              size="small"
              sx={{ p: 0, mt: 0.25 }}
              slotProps={{ input: { "aria-label": ROLE_LABEL[role] } }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700 }}>
                {ROLE_LABEL[role]}
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.25 }}>
                {ROLE_SUMMARY[role]}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
