import type { Metadata } from "next";
import { Tour } from "@/components/tour/Tour";

export const metadata: Metadata = {
  title: "Tour guiado · NeoCore Computer Lab",
  description: "Modo roteiro: o exemplo 1 executado em 7 cenas, com as falas do vídeo pitch.",
};

export default function TourPage() {
  return <Tour />;
}
