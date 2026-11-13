import type { Metadata } from "next";
import { connection } from "next/server";
import { Experience } from "@/components/experience/Experience";

export const metadata: Metadata = {
  title: "Terminal",
  description: "Navegue pelo portfólio da Tryggport Dev usando comandos.",
  alternates: { canonical: "/terminal" },
};

export default async function TerminalPage() {
  await connection();
  return <Experience initialMode="terminal" />;
}
