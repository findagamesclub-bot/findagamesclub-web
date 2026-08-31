import { notFound } from "next/navigation";
import * as templates from "@/lib/email/templates";
import { LOGO_CID, LOGO_PNG_BASE64 } from "@/lib/email/logo-data";

/** Local-only gallery for checking email templates. Hidden in production. */
export default async function EmailPreviewPage({ searchParams }: PageProps<"/dev/email-preview">) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const which = (Array.isArray(params.t) ? params.t[0] : params.t) ?? "verify";
  const url = "https://findagamesclub.co.uk/auth/confirm?token=example-token-value";

  const club = "Mana Wharf Social Club";

  const email =
    which === "tablePromoted" ? templates.tablePromoted({
      name: "Gulnabi", clubName: club, night: "Thu 3 Sep", time: "19:00 - 22:30",
      gameTitle: "Kill Team", price: "£5.00", url })
    : which === "tableCancelled" ? templates.tableCancelled({
      name: "Gulnabi", clubName: club, night: "Thu 3 Sep", url })
    : which === "ticketsBooked" ? templates.ticketsBooked({
      name: "Gulnabi", clubName: "Didcot Wargames", eventTitle: "Autumn Open",
      when: "Sat 26 Sep", reference: "FAGC-SYCMZP",
      tickets: "1 x Standard entry", total: "£28.50 to pay", url })
    : which === "ticketsCancelled" ? templates.ticketsCancelled({
      name: "Gulnabi", clubName: "Didcot Wargames", eventTitle: "Autumn Open",
      reference: "FAGC-SYCMZP", url })
    : which === "tableBooked" ? templates.tableBooked({
      name: "Gulnabi", clubName: club, night: "Thu 3 Sep", time: "19:00 - 22:30",
      gameTitle: "Kill Team", tableIndex: 4, price: "£5.00", pointsSpent: 45,
      opponentName: "Sam Whitfield", url })
    : which === "merchandiseOrdered" ? templates.merchandiseOrdered({
      name: "Gulnabi", clubName: club, reference: "Order #128",
      lines: [
        { label: "Club shirt (L) × 2", value: "£36.00" },
        { label: "Dice set", value: "£8.00" },
        { label: "Club patch", value: "To be priced" },
      ],
      total: "£40.00", pointsSpent: 40, url })
    : which === "coachingBooked" ? templates.coachingBooked({
      name: "Gulnabi", clubName: club, title: "Kill Team for beginners",
      when: "Sat 12 Sep, 10:00 to 12:00", coachingType: "one to one",
      price: "£15.00", url })
    : which === "membershipPaid" ? templates.membershipPaid({
      name: "Gulnabi", clubName: club, tierLabel: "Premium Member",
      billingLabel: "Monthly", price: "£12.00", paidUntil: "30 September 2026", url })
    : which === "tierChanged" ? templates.tierChanged({
      name: "Gulnabi", clubName: club, tierLabel: "Premium Member", url })
    : which === "membershipRequested" ? templates.membershipRequested({ name: "Gulnabi", clubName: club, url })
    : which === "membershipApproved" ? templates.membershipApproved({ name: "Gulnabi", clubName: club, tierLabel: "Premium Member", url })
    : which === "membershipDeclined" ? templates.membershipDeclined({ name: "Gulnabi", clubName: club, reason: "We are at capacity until September.", url })
    : which === "membershipForOwner" ? templates.membershipPendingForOwner({ clubName: club, applicantName: "Gulnabi Afridi", url })
    : which === "reset" ? templates.resetPassword({ name: "Gulnabi", url })
    : which === "welcome" ? templates.welcome({ name: "Gulnabi", url })
    : which === "passwordChanged" ? templates.passwordChanged({ name: "Gulnabi", url })
    : which === "changed" ? templates.emailChanged({ name: "Gulnabi", url, newEmail: "new@example.com" })
    : templates.verifyEmail({ name: "Gulnabi", url });

  // The real message carries the logo as an inline attachment, which a browser
  // can't resolve. Swap in the same bytes as a data URI so the preview matches.
  const html = email.html.replace(
    `cid:${LOGO_CID}`,
    `data:image/png;base64,${LOGO_PNG_BASE64}`,
  );

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <p style={{ margin: "0 0 12px" }}>
        {["verify", "reset", "welcome", "passwordChanged", "changed",
          "membershipRequested", "membershipForOwner", "membershipApproved", "membershipDeclined",
          "membershipPaid", "tierChanged",
          "tableBooked", "tablePromoted", "tableCancelled",
          "merchandiseOrdered", "coachingBooked",
          "ticketsBooked", "ticketsCancelled"].map((t) => (
          <a key={t} href={`?t=${t}`} style={{ marginRight: 12 }}>{t}</a>
        ))}
        <strong style={{ marginLeft: 12 }}>{email.subject}</strong>
      </p>
      <iframe title="preview" srcDoc={html} style={{ width: "100%", height: "80vh", border: "1px solid #ccc" }} />
    </div>
  );
}
