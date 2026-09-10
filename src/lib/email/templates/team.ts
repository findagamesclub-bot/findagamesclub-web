import { build, greet, type Email } from "./build";

const WHAT_THEY_CAN_DO: Record<string, string> = {
  manager: "As a manager you can edit the listing, run events, look after members, the shop and the numbers. Not the team or the billing, which stay with the owner.",
  helper: "As a helper you can run club nights: table bookings, scores, and taking a post down if it needs it.",
};

export function teamInvite(params: {
  name?: string;
  clubName: string;
  invitedBy: string;
  role: "manager" | "helper";
  url: string;
}): Email {
  return build(`${params.invitedBy} has asked you to help run ${params.clubName}`, {
    previewText: `An invitation to help run ${params.clubName}.`,
    eyebrow: "Invitation",
    heading: `Help run ${params.clubName}`,
    body: [
      greet(params.name),
      `${params.invitedBy} has invited you to join the team at ${params.clubName} as a ${params.role}.`,
      WHAT_THEY_CAN_DO[params.role] ?? "",
      "The invitation is open for fourteen days. If you would rather not, you can decline it on the same page and nobody is told anything beyond that.",
    ].filter(Boolean),
    action: { label: "Open the invitation", url: params.url },
  });
}

export function teamInviteAnswered(params: {
  name?: string;
  clubName: string;
  personName: string;
  accepted: boolean;
}): Email {
  const verb = params.accepted ? "accepted" : "declined";
  return build(`${params.personName} ${verb} your invitation`, {
    previewText: `${params.personName} ${verb}.`,
    eyebrow: params.accepted ? "Accepted" : "Declined",
    heading: `${params.personName} ${verb} your invitation`,
    body: [
      greet(params.name),
      params.accepted
        ? `${params.personName} is now on the team at ${params.clubName}. You can change their role or remove them from the Team page at any time.`
        : `${params.personName} has turned down the invitation to help run ${params.clubName}. You can invite somebody else whenever you like.`,
    ],
  });
}

export function teamRoleChanged(params: {
  name?: string;
  clubName: string;
  role: "manager" | "helper";
  url: string;
}): Email {
  return build(`Your role at ${params.clubName} changed`, {
    previewText: `You are now a ${params.role} at ${params.clubName}.`,
    eyebrow: "Role changed",
    heading: `You are now a ${params.role}`,
    body: [
      greet(params.name),
      `${params.clubName} has changed what you look after.`,
      WHAT_THEY_CAN_DO[params.role] ?? "",
    ].filter(Boolean),
    action: { label: "Open the club", url: params.url },
  });
}
