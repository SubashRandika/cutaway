import { redirect } from "next/navigation";
import { SCENES, hrefOf } from "@/lib/scenes";

export default function Home() {
  redirect(hrefOf(SCENES[0]));
}
