/**
 * Reads the repo's shared assets at runtime:
 *   ../templates/          19 note templates for POST /v3/notes
 *   ../ehr-schemas/<key>/  schema.json (Text to JSON), ehr.json (name, writable resources), README.md (verdict)
 *   ../dataset/encounters/ sample transcripts, reference notes and audio
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { KIT_ROOT } from "./config";
import type { InlineTemplate } from "./sully";
import type { EhrSummary, SampleSummary, TemplateSummary } from "./types";

const TEMPLATES_DIR = path.join(KIT_ROOT, "templates");
const EHR_DIR = path.join(KIT_ROOT, "ehr-schemas");
const ENCOUNTERS_DIR = path.join(KIT_ROOT, "dataset", "encounters");

// ---------- Templates ----------

const NAME_OVERRIDES: Record<string, string> = {
  "outpatient-soap": "Outpatient SOAP",
  "history-and-physical": "History and Physical",
  "specialty/behavioral-health-dap": "Behavioral Health (DAP)",
  "specialty/obstetrics-prenatal": "Obstetrics (Prenatal)",
  "specialty/physical-therapy-eval": "Physical Therapy Evaluation",
};

function friendlyName(id: string): string {
  if (NAME_OVERRIDES[id]) return NAME_OVERRIDES[id];
  const base = id.split("/").pop() ?? id;
  return base
    .split("-")
    .map((w) => (w === "and" ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** "Use for" descriptions from the table in templates/README.md. */
async function templateDescriptions(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const readme = await fs.readFile(path.join(TEMPLATES_DIR, "README.md"), "utf8");
    for (const m of readme.matchAll(/^\|\s*\[[^\]]+\]\(([^)]+)\.json\)\s*\|\s*([^|]+?)\s*\|/gm)) {
      out[m[1]] = m[2];
    }
  } catch {
    // README is optional
  }
  return out;
}

async function findTemplateFiles(dir: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const ids: string[] = [];
  for (const e of entries) {
    if (e.isDirectory()) ids.push(...(await findTemplateFiles(path.join(dir, e.name), `${prefix}${e.name}/`)));
    else if (e.name.endsWith(".json")) ids.push(`${prefix}${e.name.replace(/\.json$/, "")}`);
  }
  return ids;
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const [ids, descriptions] = await Promise.all([findTemplateFiles(TEMPLATES_DIR), templateDescriptions()]);
  const summaries = await Promise.all(
    ids.map(async (id) => {
      const tpl = await loadTemplate(id);
      return {
        id,
        name: friendlyName(id),
        description: descriptions[id] ?? "",
        sectionCount: tpl?.sections.length ?? 0,
      };
    }),
  );
  // Core templates first, then specialties alphabetically.
  return summaries.sort((a, b) => {
    const sa = a.id.startsWith("specialty/") ? 1 : 0;
    const sb = b.id.startsWith("specialty/") ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (a.id === "outpatient-soap") return -1;
    if (b.id === "outpatient-soap") return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function loadTemplate(id: string): Promise<InlineTemplate | undefined> {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(id)) return undefined;
  try {
    return JSON.parse(await fs.readFile(path.join(TEMPLATES_DIR, `${id}.json`), "utf8")) as InlineTemplate;
  } catch {
    return undefined;
  }
}

// ---------- EHR schemas ----------

/** The fields this app reads from ehr-schemas/<key>/ehr.json. */
type EhrConfig = { key: string; name: string; writableResources: string[] };

/** The "Can a third-party app write a note?" line at the top of each EHR README. */
function readVerdict(readme: string): string {
  const line = readme.split("\n").find((l) => l.startsWith("**Can a third-party app write a note?"));
  if (!line) return "";
  return line.replace(/\*\*/g, "").replace("Can a third-party app write a note?", "").trim();
}

export async function listEhrs(): Promise<EhrSummary[]> {
  const entries = await fs.readdir(EHR_DIR, { withFileTypes: true });
  const keys = entries.filter((e) => e.isDirectory() && !e.name.startsWith("_")).map((e) => e.name);
  const ehrs = await Promise.all(keys.map((k) => loadEhrSummary(k)));
  return ehrs.filter((e): e is EhrSummary => Boolean(e)).sort((a, b) => a.name.localeCompare(b.name));
}

async function loadEhrSummary(key: string): Promise<EhrSummary | undefined> {
  const config = await loadEhrConfig(key);
  if (!config) return undefined;
  let verdict = "";
  try {
    verdict = readVerdict(await fs.readFile(path.join(EHR_DIR, key, "README.md"), "utf8"));
  } catch {
    // no README
  }
  const shortName = config.name.replace(/\s*\(.*\)$/, "");
  return {
    key,
    name: config.name,
    verdict: verdict ? `${shortName}: ${verdict}` : shortName,
    writableResources: config.writableResources,
  };
}

function safeEhrKey(key: string): boolean {
  return /^[a-z0-9-]+$/.test(key) && !key.startsWith("_");
}

export async function loadEhrConfig(key: string): Promise<EhrConfig | undefined> {
  if (!safeEhrKey(key)) return undefined;
  try {
    return JSON.parse(await fs.readFile(path.join(EHR_DIR, key, "ehr.json"), "utf8"));
  } catch {
    return undefined;
  }
}

export async function loadEhrSchema(key: string): Promise<Record<string, unknown> | undefined> {
  if (!safeEhrKey(key)) return undefined;
  try {
    return JSON.parse(await fs.readFile(path.join(EHR_DIR, key, "schema.json"), "utf8"));
  } catch {
    return undefined;
  }
}

export async function getEhrSummary(key: string): Promise<EhrSummary | undefined> {
  return safeEhrKey(key) ? loadEhrSummary(key) : undefined;
}

// ---------- Sample encounters ----------

/** A small, varied set from the repo's dataset. Audio only ships for some encounters. */
const SAMPLE_IDS = [
  "aci-bench/aci-D2N001",
  "aci-bench/aci-D2N002",
  "primock57/pm57-d1c01",
  "primock57/pm57-d2c07",
  "fareez-osce/osce-RES0001",
  "fareez-osce/osce-MSK0001",
];

const SOURCE_NAMES: Record<string, string> = {
  "aci-bench": "ACI-Bench",
  primock57: "PriMock57",
  "fareez-osce": "Fareez OSCE",
};

function sampleDir(id: string): string | undefined {
  if (!SAMPLE_IDS.includes(id)) return undefined;
  return path.join(ENCOUNTERS_DIR, id);
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

type EncounterMetadata = {
  chiefComplaint?: string;
  patient?: { age?: number; gender?: string };
};

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export async function listSamples(): Promise<SampleSummary[]> {
  const samples = await Promise.all(
    SAMPLE_IDS.map(async (id) => {
      const dir = path.join(ENCOUNTERS_DIR, id);
      if (!(await exists(path.join(dir, "transcript.txt")))) return undefined;
      const meta = (await readJsonFile<EncounterMetadata>(path.join(dir, "metadata.json"))) ?? {};
      const source = SOURCE_NAMES[id.split("/")[0]] ?? id.split("/")[0];
      let complaint = meta.chiefComplaint ?? "";
      if (complaint.length > 48) complaint = `${complaint.slice(0, 45).trim()}...`;
      const sample: SampleSummary = {
        id,
        source,
        label: `${source}: ${capitalize(complaint) || id.split("/")[1]} (${id.split("/")[1]})`,
        hasAudio: await exists(path.join(dir, "audio.mp3")),
        hasReferenceNote: await exists(path.join(dir, "reference-note.md")),
        patient: meta.patient,
      };
      return sample;
    }),
  );
  return samples.filter((s): s is SampleSummary => Boolean(s));
}

export async function loadSampleTranscript(id: string): Promise<string | undefined> {
  const dir = sampleDir(id);
  if (!dir) return undefined;
  try {
    return await fs.readFile(path.join(dir, "transcript.txt"), "utf8");
  } catch {
    return undefined;
  }
}

export async function loadSampleReferenceNote(id: string): Promise<string | undefined> {
  const dir = sampleDir(id);
  if (!dir) return undefined;
  try {
    return await fs.readFile(path.join(dir, "reference-note.md"), "utf8");
  } catch {
    return undefined;
  }
}

export function sampleAudioPath(id: string): string | undefined {
  const dir = sampleDir(id);
  return dir ? path.join(dir, "audio.mp3") : undefined;
}

export function isSampleId(id: string | undefined): id is string {
  return Boolean(id && SAMPLE_IDS.includes(id));
}

async function readJsonFile<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}
