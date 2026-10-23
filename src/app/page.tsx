import { redirect } from "next/navigation";

// A aquisição agora acontece no quiz externo (anúncio → quiz → /api/checkout).
// Quem entra direto no domínio cai na tela de login.
export default function Home() {
  redirect("/login");
}
