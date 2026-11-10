import { connection } from "next/server";
import { ProviderManager } from "@/components/admin/ProviderManager";
import { PageHeading } from "@/components/ui/Card";
import { listEhrs, listTemplates } from "@/lib/kit";
import { requirePageUser } from "@/lib/auth";
import { listProviders } from "@/lib/store";

export default async function AdminPage() {
  await connection();
  await requirePageUser("admin");
  const [providers, templates, ehrs] = await Promise.all([listProviders(), listTemplates(), listEhrs()]);
  return (
    <div className="flex flex-col">
      <section className="mx-auto w-full max-w-[1200px] px-6 pt-10 pb-12">
        <PageHeading before="Manage" highlight="providers" />
      </section>
      <section className="bg-cream">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
          <ProviderManager initialProviders={providers} templates={templates} ehrs={ehrs} />
        </div>
      </section>
    </div>
  );
}
