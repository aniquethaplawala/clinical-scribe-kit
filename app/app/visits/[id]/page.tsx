import { notFound } from "next/navigation";
import { connection } from "next/server";
import { VisitView } from "@/components/visit/VisitView";
import { canView, requirePageUser } from "@/lib/auth";
import { listEhrs } from "@/lib/kit";
import { getProvider, getVisit } from "@/lib/store";

export default async function VisitPage({ params }: PageProps<"/visits/[id]">) {
  await connection();
  const user = await requirePageUser();
  const { id } = await params;
  const [visit, ehrs] = await Promise.all([getVisit(id), listEhrs()]);
  // Another provider's visit looks exactly like a missing one.
  if (!visit || !canView(user, visit)) notFound();
  const formerProvider = !(await getProvider(visit.provider.id));
  return <VisitView initialVisit={visit} ehrs={ehrs} readOnly={visit.provider.id !== user.id} formerProvider={formerProvider} />;
}
