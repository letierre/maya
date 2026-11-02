import { redirect } from "next/navigation";

// A aquisição acontece no quiz externo (anúncio → quiz → Stripe via Payment Link).
// Quem entra direto no domínio cai na tela de login.
export default function Home() {
  redirect("/login");
}
