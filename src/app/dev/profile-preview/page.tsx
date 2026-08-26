import { notFound } from "next/navigation";
import MemberProfileView from "@/components/members/MemberProfileView";
import type { MemberProfile } from "@/types/profile";

/** Local-only. The real profile pages sit behind sign-in, and design work needs
 *  to be looked at, not imagined. */
export default function ProfilePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const filled: MemberProfile = {
    id: "1ee93437-165d-46ae-83d5-9781ff7a11e5",
    fullName: "Gulnabi Afridi",
    bio: "Been painting Death Guard since 2019 and playing most Thursdays at Didcot. Happy to teach anyone new to 40k, and I always bring a spare army so nobody sits out.",
    homeArea: "OX11",
    travelMiles: 30,
    games: ["Warhammer 40,000", "Kill Team", "Age of Sigmar", "Star Wars: Shatterpoint"],
    armies: ["Death Guard", "Custodes", "Orks"],
    availability: ["Tuesday", "Thursday", "Saturday"],
    ageGroups: ["18+"],
    playStyle: ["Narrative", "Painting and hobby", "Teaching newcomers"],
    memberSince: "April 2026",
    isAdmin: false,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _empty: MemberProfile = {
    id: "6fa4fc73-f094-4d19-8900-d7dd0067b348",
    fullName: "gul",
    games: [], armies: [], availability: [], ageGroups: [], playStyle: [],
    memberSince: "August 2026",
    isAdmin: false,
  };

  return <MemberProfileView profile={filled} isSelf />;
}
