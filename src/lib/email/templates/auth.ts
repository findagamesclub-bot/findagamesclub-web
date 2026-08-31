import { build, greet, type Email } from "./build";

export function verifyEmail(params: { name?: string; url: string }): Email {
  const greeting = greet(params.name);
  return build("Confirm your email address", {
    previewText: "One click to finish setting up your FindAGamesClub account.",
    eyebrow: "Confirm your email",
    heading: "Finish setting up your account",
    body: [
      greeting,
      "Confirm this address and you can sign in, join clubs and book a table.",
    ],
    action: { label: "Confirm email address", url: params.url },
    footnote: "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
  });
}

export function resetPassword(params: { name?: string; url: string }): Email {
  const greeting = greet(params.name);
  return build("Reset your password", {
    previewText: "Choose a new password for your FindAGamesClub account.",
    eyebrow: "Password reset",
    heading: "Choose a new password",
    body: [greeting, "Use the link below to set a new password."],
    action: { label: "Set a new password", url: params.url },
    footnote:
      "This link expires in one hour and can be used once. If you did not ask for it, your password has not changed and no action is needed.",
  });
}

export function welcome(params: { name?: string; url: string }): Email {
  const greeting = params.name ? `Welcome, ${params.name}.` : "Welcome.";
  return build("Welcome to FindAGamesClub", {
    previewText: "Your account is ready. Find a club near you.",
    eyebrow: "Account created",
    heading: "You're in",
    body: [
      greeting,
      "Search by town, by what a club plays, or by how far you'll travel. Club pages show when they meet, whether tables can be booked, and what it costs.",
    ],
    action: { label: "Find a club", url: params.url },
  });
}

export function passwordChanged(params: { name?: string; url: string }): Email {
  const greeting = greet(params.name);
  return build("Your password was changed", {
    previewText: "The password on your FindAGamesClub account has been changed.",
    eyebrow: "Password changed",
    heading: "Your password was changed",
    body: [
      greeting,
      "The password on your FindAGamesClub account has just been changed. You can sign in with it now.",
    ],
    action: { label: "Sign in", url: params.url },
    // The point of this email is the warning. Someone who did change their own
    // password can ignore it; someone who didn't needs to act.
    footnote:
      "If this wasn't you, reset your password immediately and contact us at hello@findagamesclub.co.uk.",
  });
}

export function emailChanged(params: { name?: string; url: string; newEmail: string }): Email {
  const greeting = greet(params.name);
  return build("Confirm your new email address", {
    previewText: "Confirm the new address on your FindAGamesClub account.",
    eyebrow: "Email change",
    heading: "Confirm your new address",
    body: [greeting, `Confirm ${params.newEmail} to finish moving your account to it.`],
    action: { label: "Confirm new address", url: params.url },
    footnote: "Until you confirm, your account keeps using the old address.",
  });
}
