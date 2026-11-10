"use client";

import { KeyRound, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Field, Input, Select } from "@/components/ui/Field";
import { api, asAppError, postJson } from "@/lib/client";
import type { AppError, Credential, EhrSummary, Provider, TemplateSummary } from "@/lib/types";

type Draft = Omit<Provider, "id" | "createdAt" | "role"> & { password: string };
const CREDENTIALS: Credential[] = ["MD", "DO", "NP", "PA"];

function emptyDraft(templates: TemplateSummary[], ehrs: EhrSummary[]): Draft {
  return {
    name: "",
    email: "",
    password: "",
    credentials: "MD",
    specialty: "",
    npi: "",
    defaultTemplateId: templates[0]?.id ?? "",
    defaultEhrKey: ehrs.find((e) => e.key === "epic")?.key ?? ehrs[0]?.key ?? "",
  };
}

export function ProviderManager({
  initialProviders,
  templates,
  ehrs,
}: {
  initialProviders: Provider[];
  templates: TemplateSummary[];
  ehrs: EhrSummary[];
}) {
  const [providers, setProviders] = useState(initialProviders);
  const [editingId, setEditingId] = useState<string | null>(null); // null = adding a new provider
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(templates, ehrs));
  const [error, setError] = useState<AppError | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const templateName = (id: string) => templates.find((t) => t.id === id)?.name ?? id;
  const ehrName = (key: string) => ehrs.find((e) => e.key === key)?.name ?? key;

  function startEdit(p: Provider) {
    setEditingId(p.id);
    setDraft({ ...p, npi: p.npi ?? "", password: "" });
    setError(null);
    setMessage("");
    document.getElementById("provider-name")?.focus();
  }

  function startNew() {
    setEditingId(null);
    setDraft(emptyDraft(templates, ehrs));
    setError(null);
    setMessage("");
    document.getElementById("provider-name")?.focus();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const { provider } = await api<{ provider: Provider }>(`/api/providers/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        setProviders((list) => list.map((p) => (p.id === provider.id ? provider : p)));
        setMessage(`Saved ${provider.name}.`);
      } else {
        const { provider } = await postJson<{ provider: Provider }>("/api/providers", draft);
        setProviders((list) => [...list, provider]);
        setMessage(`Created a login for ${provider.name} (${provider.email}).`);
        setDraft(emptyDraft(templates, ehrs));
      }
    } catch (err) {
      setError(asAppError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Provider) {
    if (!window.confirm(`Delete ${p.name}? Their login stops working. Their visits are kept and shown as "former provider".`)) return;
    try {
      await api(`/api/providers/${p.id}`, { method: "DELETE" });
      setProviders((list) => list.filter((x) => x.id !== p.id));
      if (editingId === p.id) startNew();
      setMessage(`Deleted ${p.name}.`);
    } catch (err) {
      setError(asAppError(err));
    }
  }

  async function resetPassword(p: Provider) {
    const password = window.prompt(`New password for ${p.name} (at least 8 characters):`);
    if (!password) return;
    setError(null);
    try {
      await postJson(`/api/providers/${p.id}/password`, { password });
      setMessage(`Password reset for ${p.name}.`);
    } catch (err) {
      setError(asAppError(err));
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-medium">
            {providers.length} provider{providers.length === 1 ? "" : "s"}
          </h2>
          <Button variant="secondary" size="sm" onClick={startNew}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            Add provider
          </Button>
        </div>
        {providers.length === 0 ? (
          <p className="rounded-[16px] bg-paper p-8 text-center text-graphite">No provider accounts yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {providers.map((p) => (
              <li
                key={p.id}
                className={`flex flex-col gap-4 rounded-[16px] border bg-paper p-5 sm:flex-row sm:items-center sm:justify-between ${editingId === p.id ? "border-ink" : "border-fog"}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream">
                    <UserRound aria-hidden className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[16px] font-medium">
                      {p.name}, {p.credentials}
                    </span>
                    <span className="text-[14px] text-graphite">{p.email}</span>
                    <span className="text-[14px] text-graphite">
                      {p.specialty}
                      {p.npi ? ` · NPI ${p.npi}` : ""}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone="outline">{templateName(p.defaultTemplateId)}</Badge>
                      <Badge tone="outline">{ehrName(p.defaultEhrKey)}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`}>
                    <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.5} />
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => resetPassword(p)} aria-label={`Reset password for ${p.name}`}>
                    <KeyRound aria-hidden className="h-4 w-4" strokeWidth={1.5} />
                    Password
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>
                    <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.5} />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={save} className="flex h-fit flex-col gap-5 rounded-[16px] bg-paper p-6 md:p-8" aria-labelledby="provider-form-title">
        <h2 id="provider-form-title" className="text-[24px] font-medium tracking-[-0.02em]">
          {editingId ? "Edit provider" : "New provider account"}
        </h2>
        <Field label="Full name" htmlFor="provider-name">
          <Input id="provider-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Maya Chen" required />
        </Field>
        <Field label="Email (login)" htmlFor="provider-email">
          <Input id="provider-email" type="email" autoComplete="off" value={draft.email} onChange={(e) => set("email", e.target.value)} required />
        </Field>
        {editingId ? null : (
          <Field label="Initial password" htmlFor="provider-password">
            <Input
              id="provider-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={draft.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Credentials" htmlFor="provider-credentials">
            <Select id="provider-credentials" value={draft.credentials} onChange={(e) => set("credentials", e.target.value as Credential)}>
              {CREDENTIALS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="NPI (optional)" htmlFor="provider-npi">
            <Input id="provider-npi" inputMode="numeric" value={draft.npi ?? ""} onChange={(e) => set("npi", e.target.value)} placeholder="10 digits" />
          </Field>
        </div>
        <Field label="Specialty" htmlFor="provider-specialty">
          <Input id="provider-specialty" value={draft.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="e.g. Family Medicine" required />
        </Field>
        <Field label="Default note template" htmlFor="provider-template">
          <Select id="provider-template" value={draft.defaultTemplateId} onChange={(e) => set("defaultTemplateId", e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Default EHR" htmlFor="provider-ehr">
          <Select id="provider-ehr" value={draft.defaultEhrKey} onChange={(e) => set("defaultEhrKey", e.target.value)}>
            {ehrs.map((e) => (
              <option key={e.key} value={e.key}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        {error ? <ErrorNotice error={error} /> : null}
        <p aria-live="polite" className="text-[14px] text-graphite empty:hidden">
          {message}
        </p>
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create account"}
          </Button>
          {editingId ? (
            <Button variant="secondary" onClick={startNew}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
