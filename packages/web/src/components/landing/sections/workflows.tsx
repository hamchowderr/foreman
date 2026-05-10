import { WorkflowExtraction } from "@/components/landing/demos/workflow-extraction";
import { Reveal } from "@/components/landing/reveal";
import { Badge } from "@/components/ui/badge";

export function Workflows() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-24">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">
            Workflows
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            A workflow is just a conversation you saved.
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            When a sequence works, say &apos;save that.&apos; Foreman extracts the steps into a
            reusable workflow with streamed progress and run history. No canvas, no trigger picker,
            no 14-field mapping — just the chat you already had.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <WorkflowExtraction />
        </Reveal>
      </div>
    </section>
  );
}
