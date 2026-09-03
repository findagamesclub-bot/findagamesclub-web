"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import OrderSummary from "./OrderSummary";
import CheckoutForm from "./CheckoutForm";
import { priceTickets, type TicketStanding } from "@/utils/ticket-pricing";
import type { EventCart } from "@/types/ticket";
import type { Faction } from "@/lib/tokens";

/**
 * The two halves of checkout, sharing one figure.
 *
 * The points field used to hold its own state on the right, which left the
 * order total on the left and the button underneath both quoting the price
 * before points. Three totals, two of them wrong. The state lives here now and
 * every figure on the page comes from one `priceTickets` call.
 */
export default function CheckoutPanels({
  cart, standing, slug, eventKey, eventId, fullName, email, faction,
}: {
  cart: EventCart;
  standing: TicketStanding;
  slug: string;
  eventKey: string;
  eventId: number;
  fullName: string;
  email: string;
  faction: Faction;
}) {
  const [points, setPoints] = useState(0);
  const price = priceTickets(standing, points);

  return (
    <Box sx={{ display: "grid", gap: 4, alignItems: "start",
               gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0,1.2fr) minmax(320px,1fr)" } }}>
      <OrderSummary cart={cart} price={price} tierLabel={standing.tierLabel} faction={faction} />

      {/* Sticky, so a long order never pushes the one action off screen. */}
      <Box sx={{ position: { md: "sticky" }, top: { md: 96 } }}>
        <CheckoutForm
          slug={slug}
          eventKey={eventKey}
          eventId={eventId}
          fullName={fullName}
          email={email}
          currency={cart.currency}
          faction={faction}
          standing={standing}
          price={price}
          points={points}
          onPoints={setPoints}
        />
      </Box>
    </Box>
  );
}
