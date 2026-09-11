import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import ShopEditor from "@/app/clubs/[slug]/(console)/manage/shop/ShopEditor";
import { clubIdentity } from "@/utils/club-identity";
import type { EditableItem } from "@/repositories/shopEditor.repository";

/**
 * Local-only view of the shop editor.
 *
 * Three cases side by side that a club would otherwise only meet one at a
 * time: an item with a picture and three sizes, one with no picture at all,
 * and a retired one kept for a tier.
 */
export default function ShopEditorPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { faction } = clubIdentity("didcot-wargames-didcot", "Didcot Wargames");

  const items: EditableItem[] = [
    {
      id: 1, name: "Club t shirt", category: "Clothing", description: "", price: "£15",
      minimumTierKey: "", active: true,
      image: { src: "/clubs/assets/mana-wharf.svg", alt: "Club t shirt" },
      sizes: [
        { id: 1, label: "S", stock: 2, active: true },
        { id: 2, label: "M", stock: 0, active: true },
        { id: 3, label: "L", stock: 3, active: true },
      ],
    },
    {
      id: 2, name: "Club Jumper", category: "Clothing", description: "", price: "£25",
      minimumTierKey: "", active: true, image: null,
      sizes: [{ id: 4, label: "", stock: 9, active: true }],
    },
    {
      id: 3, name: "Limited anniversary dice, in the club's own colours",
      category: "Accessories", description: "", price: "£8",
      minimumTierKey: "premium-membership", active: false, image: null,
      sizes: [{ id: 5, label: "", stock: 0, active: false }],
    },
    {
      id: 4, name: "Dice bag", category: "Accessories", description: "", price: "£6",
      minimumTierKey: "", active: true, image: null,
      sizes: [
        { id: 6, label: "Small", stock: 1, active: true },
        { id: 7, label: "Extra extra large", stock: 4, active: true },
      ],
    },
  ];

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h2" sx={{ fontSize: "1.4rem", mb: 2.5 }}>Shop editor</Typography>
      <ShopEditor slug="didcot-wargames-didcot" clubId={9} items={items} faction={faction}
        tiers={[{ key: "premium-membership", label: "Premium Membership" }]} />
    </Container>
  );
}
