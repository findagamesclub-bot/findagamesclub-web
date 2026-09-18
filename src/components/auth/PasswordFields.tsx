"use client";

import { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import { useAuthFormValidity } from "./AuthForm";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import { passwordAllowed } from "@/utils/password-strength";

type Props = {
  /** "Password" on sign-up, "New password" on the reset form. */
  label?: string;
  /**
   * The address being signed up, so the meter can say when the password is
   * built out of it. The reset form has no email field but is signed in, so its
   * page reads the address and passes it down; without it the meter read Good on
   * a password the server then refused. Left out only where there is genuinely
   * no address, and
   * then read from the form itself.
   */
  email?: string;
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
export default function PasswordFields({ label = "Password", email }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Read off the sibling field rather than lifted into shared state: the
  // address is only ever needed to tell somebody their password is built out
  // of it, and a context for one string would be a context to maintain.
  const [typedEmail, setTypedEmail] = useState("");
  const setValid = useAuthFormValidity();

  const onPassword = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    const field = event.target.form?.elements.namedItem("email");
    setTypedEmail(field instanceof HTMLInputElement ? field.value : "");
  };

  // Don't shout before they've had a chance to finish the second field.
  const mismatch = confirm.length > 0 && password !== confirm;
  // Legacy's own length rule, plus a floor at Fair. The server checks again:
  // this is for the person filling in the form, not for trusting what arrives.
  const against = email ?? typedEmail;
  const allowed = passwordAllowed(password, against);
  const ready = password.length > 0 && password === confirm && allowed.ok;

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
        onChange={onPassword}
      />
      <PasswordStrengthMeter password={password} email={against} />
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
