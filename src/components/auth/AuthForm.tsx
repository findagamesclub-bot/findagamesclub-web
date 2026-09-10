"use client";

import { createContext, useActionState, useContext, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import NextLink from "next/link";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SubmitButton from "@/components/ui/SubmitButton";
import type { FormState } from "@/app/auth/actions";

/**
 * Lets a field tell the form it isn't ready yet, so the submit button can go
 * quiet. Context rather than props because the fields are passed in as
 * children — the form has no way to reach into them.
 */
const ValidityContext = createContext<(valid: boolean) => void>(() => {});

export function useAuthFormValidity() {
  return useContext(ValidityContext);
}

/**
 * What was typed last time, for a form that came back with an error.
 *
 * Same reason as the validity context: the fields arrive as children, so the
 * form cannot pass them anything directly. React resets the form once the
 * action returns, and a reset restores each field to its defaultValue, so
 * feeding the value back in as the default is what makes it survive.
 */
const ValuesContext = createContext<FormState["values"]>(undefined);

export function useAuthFieldValue(name: "fullName" | "email"): string {
  return useContext(ValuesContext)?.[name] ?? "";
}

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
  const [fieldsValid, setFieldsValid] = useState(true);

  return (
    <Card sx={{ maxWidth: 460, mx: "auto", width: "100%" }}>
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <form action={formAction}>
          <Stack spacing={2.5}>
            <Stack spacing={0.75}>
              <Typography variant="overline" color="text.secondary">{eyebrow}</Typography>
              <Typography variant="h2" sx={{ fontSize: "1.95rem" }}>{heading}</Typography>
              {intro ? <Typography variant="body2" color="text.secondary">{intro}</Typography> : null}
            </Stack>

            {state.error ? (
              <Alert severity="error">
                {state.error}
                {/* Inside the alert, because it is part of the refusal: being
                    told no is only half of it if there is nothing to do next. */}
                {state.help ? (
                  <Box sx={{ mt: 0.75 }}>
                    <NextLink href={state.help.href}
                      style={{ color: "inherit", fontWeight: 600 }}>
                      {state.help.label}
                    </NextLink>
                  </Box>
                ) : null}
              </Alert>
            ) : null}
            {state.notice ? <Alert severity="success">{state.notice}</Alert> : null}

            <ValuesContext.Provider value={state.values}>
              <ValidityContext.Provider value={setFieldsValid}>{children}</ValidityContext.Provider>
            </ValuesContext.Provider>

            <SubmitButton label={submitLabel} pendingLabel={pendingLabel} blocked={!fieldsValid} fullWidth />

            {footer}
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
