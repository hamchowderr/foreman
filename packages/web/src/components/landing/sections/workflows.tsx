import { Reveal } from "@/components/landing/reveal";
import { WorkflowExtraction } from "@/components/landing/demos/workflow-extraction";
import { Badge } from "@/components/ui/badge";

export function Workflows() {
  return (
    <section className="bg-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-24">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">Workflows</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Do it once. Save the pattern.
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            When a sequence repeats, Foreman extracts it as a reusable workflow
            — with streamed progress and run history. Built from the
            conversation, not a canvas.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <WorkflowExtraction />
        </Reveal>
      </div>
    </section>
  );
}
