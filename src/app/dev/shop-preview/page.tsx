import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import ClubShop from "@/components/shop/ClubShop";
import { clubIdentity } from "@/utils/club-identity";
import type { MerchItem, ShopStanding } from "@/types/clubExtras";

/**
 * Local-only view of the club shop.
 *
 * The bag lives in the browser, so every bug in it is a bug nobody can see
 * without signing in as a member of a club that sells something.
 */
export default function ShopPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { faction, monogram } = clubIdentity("didcot-wargames-didcot", "Didcot Wargames");

  const items: MerchItem[] = [
    {
      id: 1, name: "Club t shirt", category: "Clothing", description: null,
      image: null, price: "£15", stock: 5, soldOut: false, blockedReason: null,
      variants: [
        { id: 10, label: "S", stock: 2, soldOut: false },
        { id: 11, label: "M", stock: 0, soldOut: true },
        { id: 12, label: "L", stock: 3, soldOut: false },
      ],
    },
    {
      id: 2, name: "Club Jumper", category: "Clothing", description: null,
      image: null, price: "£25", stock: 9, soldOut: false, blockedReason: null,
      variants: [{ id: 20, label: "", stock: 9, soldOut: false }],
    },
  ];

  const standing: ShopStanding = {
    discountPercent: 10, tierLabel: "Premium Membership", points: 383,
    pointValue: 0.05, redemptionCapPercent: 50, offer: null, earnPerOrder: 5,
  };

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h2" sx={{ fontSize: "1.4rem", mb: 2.5 }}>Club shop</Typography>
      <ClubShop items={items} faction={faction} monogram={monogram}
        slug="didcot-wargames-didcot" clubId={9} profileId="preview" standing={standing} />
    </Container>
  );
}
