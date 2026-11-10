import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "./Panel";

export function TranscriptPanel({ transcript }: { transcript: string }) {
  const lines = transcript.split("\n");
  return (
    <Panel
      title="Transcript"
      actions={<CopyButton text={transcript} label="Copy transcript" />}
    >
      <div className="flex flex-col gap-3 text-[16px] leading-relaxed">
        {lines.map((line, i) => {
          const m = /^(Clinician|Patient|Family member|Speaker \d+):\s*(.*)$/.exec(line);
          if (!line.trim()) return null;
          return m ? (
            <p key={i}>
              <span className="mr-2 inline-block min-w-[88px] text-[14px] font-medium text-graphite">{m[1]}</span>
              {m[2]}
            </p>
          ) : (
            <p key={i}>{line}</p>
          );
        })}
      </div>
    </Panel>
  );
}
