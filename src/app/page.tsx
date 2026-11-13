import { connection } from "next/server";
import { Experience } from "@/components/experience/Experience";

export default async function HomePage() {
  // Renderização dinâmica: necessária para o nonce da CSP em cada requisição.
  await connection();
  return <Experience initialMode="visual" />;
}
