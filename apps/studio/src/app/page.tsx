import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function RootPage() {
  const user = await getUser();
  
  if (user) {
    redirect("/projects");
  } else {
    redirect("/auth/signin");
  }
}
