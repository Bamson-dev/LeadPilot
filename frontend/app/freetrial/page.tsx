import { redirect } from "next/navigation";

export default function FreeTrialPage() {
  redirect("/checkout");
}
