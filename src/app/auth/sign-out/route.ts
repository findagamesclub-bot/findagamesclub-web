import { redirect } from "next/navigation";
import { signOut } from "@/services/auth.service";

export async function POST() {
  await signOut();
  redirect("/clubs");
}
