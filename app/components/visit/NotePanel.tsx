import { Button } from "@/components/ui/Button";
import { CopyButton, DownloadButton } from "@/components/ui/CopyButton";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Markdown } from "@/components/ui/Markdown";
import type { Visit } from "@/lib/types";
import { Loading, Panel } from "./Panel";

export function NotePanel({ visit, onRetry }: { visit: Visit; onRetry?: () => void }) {
  const { note } = visit;
  const text = note.result?.note ?? "";
  return (
    <Panel
      title="Clinical note"
      actions={
        text ? (
          <>
            <CopyButton text={text} label="Copy note" />
            <DownloadButton text={text} filename={`note-${visit.id.slice(0, 8)}.md`} label="Download .md" type="text/markdown" />
          </>
        ) : null
      }
    >
      {note.status === "running" || note.status === "idle" ? <Loading label="Writing the note..." /> : null}
      {note.status === "error" && note.error ? (
        <ErrorNotice
          error={note.error}
          action={
            onRetry ? (
              <Button size="sm" onClick={onRetry}>
                Try again
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {text ? <Markdown>{text}</Markdown> : null}
    </Panel>
  );
}
