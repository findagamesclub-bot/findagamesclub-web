"use client";

import TextField from "@mui/material/TextField";
import type { TextFieldProps } from "@mui/material/TextField";
import { useAuthFieldValue } from "./AuthForm";

/**
 * A field on an auth form that survives a rejected submit.
 *
 * React resets an uncontrolled form when its action returns, and a reset puts
 * every field back to its defaultValue. Handing the last submitted value in as
 * that default is what keeps somebody's name and address on the screen when
 * the only thing wrong was their password.
 */
export default function AuthField({
  name, ...rest
}: Omit<TextFieldProps, "name" | "defaultValue"> & { name: "fullName" | "email" }) {
  const value = useAuthFieldValue(name);
  // Remounts when the value changes, so the default is applied rather than
  // being ignored on a field the browser has already painted.
  return <TextField key={value} name={name} defaultValue={value} {...rest} />;
}
