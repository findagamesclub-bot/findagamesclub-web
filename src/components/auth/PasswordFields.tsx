"use client";

import { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import { useAuthFormValidity } from "./AuthForm";

type Props = {
  /** "Password" on sign-up, "New password" on the reset form. */
  label?: string;
};

/**
 * Password plus confirmation, checked as you type.
 *
 * The mismatch used to surface only after submitting, which meant filling in
 * the form, pressing the button and being told to start the last field again.
 * The message appears on the field itself as soon as there is enough typed to
 * be wrong, and the submit button stays disabled until they agree.
 *
 * The server still checks. Client-side validation is for the person filling in
 * the form, not for trusting what arrives.
 */
export default function PasswordFields({ label = "Password" }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const setValid = useAuthFormValidity();

  // Don't shout before they've had a chance to finish the second field.
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length > 0 && password === confirm;

  useEffect(() => {
    setValid(ready);
    // On unmount the fields are gone, so nothing here should block the form.
    return () => setValid(true);
  }, [ready, setValid]);

  return (
    <>
      <TextField
        name="password"
        type="password"
        label={label}
        required
        autoComplete="new-password"
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        name="confirm"
        type="password"
        label="Confirm password"
        required
        autoComplete="new-password"
        fullWidth
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={mismatch}
        helperText={mismatch ? "Those passwords do not match." : " "}
      />
    </>
  );
}
