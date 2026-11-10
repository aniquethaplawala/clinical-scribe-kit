import { redirect } from "next/navigation";
import { connection } from "next/server";
import { NewVisitForm } from "@/components/new-visit/NewVisitForm";
import { PageHeading } from "@/components/ui/Card";
import { isDemoMode } from "@/lib/config";
import { listEhrs, listSamples, listTemplates } from "@/lib/kit";
import { requirePageUser } from "@/lib/auth";
import { getProvider } from "@/lib/store";

export default async function NewVisitPage() {
  await connection();
  const user = await requirePageUser("provider");
  const [provider, templates, ehrs, samples] = await Promise.all([getProvider(user.id), listTemplates(), listEhrs(), listSamples()]);
  if (!provider) redirect("/login");
  return (
    <div className="flex flex-col">
      <section className="mx-auto w-full max-w-[1200px] px-6 pt-10 pb-12">
        <PageHeading before="Start a" highlight="visit" />
      </section>
      <section className="bg-cream">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
          <NewVisitForm provider={provider} templates={templates} ehrs={ehrs} samples={samples} demo={isDemoMode()} />
        </div>
      </section>
    </div>
  );
}
