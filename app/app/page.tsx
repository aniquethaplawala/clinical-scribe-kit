import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, FileText, Mic, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/Card";
import { formatDate, INPUT_LABELS, patientLabel } from "@/lib/format";
import { requirePageUser } from "@/lib/auth";
import { listProviders, listVisits } from "@/lib/store";
import type { InputMethod, Visit } from "@/lib/types";

const METHOD_ICONS: Record<InputMethod, typeof Mic> = { upload: Upload, paste: FileText, live: Mic };

export default async function HomePage() {
  await connection();
  const user = await requirePageUser();
  const isAdmin = user.role === "admin";
  const all = await listVisits();
  // Providers see only their own visits; the admin sees everyone's (read only).
  const visits = isAdmin ? all : all.filter((v) => v.provider.id === user.id);
  const activeIds = new Set((await listProviders()).map((p) => p.id));

  return (
    <div className="flex flex-col">
      <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 pt-10 pb-12 md:flex-row md:items-end md:justify-between">
        <PageHeading before={isAdmin ? "All" : "Your"} highlight="visits" />
        {isAdmin ? null : <ButtonLink href="/visits/new">New visit</ButtonLink>}
      </section>

      <section className="bg-cream">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
          {visits.length === 0 ? <EmptyState isAdmin={isAdmin} /> : <VisitList visits={visits} activeIds={activeIds} />}
        </div>
      </section>
    </div>
  );
}

function VisitList({ visits, activeIds }: { visits: Visit[]; activeIds: Set<string> }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Saved visits">
      {visits.map((v) => {
        const Icon = METHOD_ICONS[v.inputMethod];
        return (
          <li key={v.id}>
            <Link
              href={`/visits/${v.id}`}
              className="group grid grid-cols-1 gap-3 rounded-[16px] border border-fog bg-paper p-5 hover:border-silver md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center md:gap-6 md:px-6"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[16px] font-medium">{patientLabel(v.patient)}</span>
                <span className="text-[14px] text-graphite">{formatDate(v.createdAt)}</span>
              </div>
              <div className="flex flex-col gap-1 text-[14px]">
                <span>
                  {v.provider.name}, {v.provider.credentials}
                </span>
                <span className="text-graphite">
                  {activeIds.has(v.provider.id) ? v.provider.specialty : "Former provider"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="outline">{v.templateName}</Badge>
                <Badge tone="outline">
                  <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {INPUT_LABELS[v.inputMethod]}
                </Badge>
                {v.demo ? <Badge>Demo</Badge> : null}
                {v.note.status === "error" ? <Badge>Note failed</Badge> : null}
              </div>
              <ArrowRight aria-hidden className="hidden h-5 w-5 text-graphite transition group-hover:translate-x-0.5 md:block" strokeWidth={1.5} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[16px] bg-paper px-6 py-16 text-center">
      <Mic aria-hidden className="h-8 w-8 text-graphite" strokeWidth={1.5} />
      <h2 className="text-[24px] font-medium tracking-[-0.02em]">No visits yet</h2>
      {isAdmin ? null : <ButtonLink href="/visits/new">Start a visit</ButtonLink>}
    </div>
  );
}
