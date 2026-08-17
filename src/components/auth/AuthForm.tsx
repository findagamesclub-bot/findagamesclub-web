"use client";

import { useActionState } from "react";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SubmitButton from "@/components/ui/SubmitButton";
import type { FormState } from "@/app/auth/actions";

type Props = {
  eyebrow: string;
  heading: string;
  intro?: string;
  submitLabel: string;
  /** Present tense, shown beside the spinner while the action runs. */
  pendingLabel: string;
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthForm({ eyebrow, heading, intro, submitLabel, pendingLabel, action, children, footer }: Props) {
  const [state, formAction] = useActionState(action, {});

  return (
    <Card sx={{ maxWidth: 460, mx: "auto", width: "100%" }}>
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <form action={formAction}>
          <Stack spacing={2.5}>
            <Stack spacing={0.75}>
              <Typography variant="overline" color="text.secondary">{eyebrow}</Typography>
              <Typography variant="h2" sx={{ fontSize: "1.75rem" }}>{heading}</Typography>
              {intro ? <Typography variant="body2" color="text.secondary">{intro}</Typography> : null}
            </Stack>

            {state.error ? <Alert severity="error">{state.error}</Alert> : null}
            {state.notice ? <Alert severity="success">{state.notice}</Alert> : null}

            {children}

            <SubmitButton label={submitLabel} pendingLabel={pendingLabel} fullWidth />

            {footer}
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
