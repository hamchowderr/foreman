"use client";

import { BrainIcon, EyeIcon, LockIcon, WrenchIcon } from "lucide-react";
import { memo, useState } from "react";
import useSWR from "swr";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  type ChatModel,
  chatModels,
  DEFAULT_CHAT_MODEL,
  type ModelCapabilities,
} from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: modelsData } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 }
  );

  const capabilities: Record<string, ModelCapabilities> | undefined =
    modelsData?.capabilities ?? modelsData;
  const dynamicModels: ChatModel[] | undefined = modelsData?.models;
  const activeModels = dynamicModels ?? chatModels;

  const selectedModel =
    activeModels.find((m: ChatModel) => m.id === selectedModelId) ??
    activeModels.find((m: ChatModel) => m.id === DEFAULT_CHAT_MODEL) ??
    activeModels[0];
  const [provider] = selectedModel.id.split("/");

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button
          className="h-7 max-w-[200px] justify-between gap-1.5 rounded-lg px-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          data-testid="model-selector"
          variant="ghost"
        >
          {provider && <ModelSelectorLogo provider={provider} />}
          <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          {(() => {
            const curatedIds = new Set(chatModels.map((m) => m.id));
            const allModels = dynamicModels
              ? [
                  ...chatModels,
                  ...dynamicModels.filter((m) => !curatedIds.has(m.id)),
                ]
              : chatModels;

            const grouped: Record<
              string,
              { model: ChatModel; curated: boolean }[]
            > = {};
            for (const model of allModels) {
              const key = curatedIds.has(model.id)
                ? "_available"
                : model.provider;
              if (!grouped[key]) {
                grouped[key] = [];
              }
              grouped[key].push({ model, curated: curatedIds.has(model.id) });
            }

            const sortedKeys = Object.keys(grouped).sort((a, b) => {
              if (a === "_available") {
                return -1;
              }
              if (b === "_available") {
                return 1;
              }
              return a.localeCompare(b);
            });

            const providerNames: Record<string, string> = {
              alibaba: "Alibaba",
              anthropic: "Anthropic",
              "arcee-ai": "Arcee AI",
              bytedance: "ByteDance",
              cohere: "Cohere",
              deepseek: "DeepSeek",
              google: "Google",
              inception: "Inception",
              kwaipilot: "Kwaipilot",
              meituan: "Meituan",
              meta: "Meta",
              minimax: "MiniMax",
              mistral: "Mistral",
              moonshotai: "Moonshot",
              morph: "Morph",
              nvidia: "Nvidia",
              openai: "OpenAI",
              perplexity: "Perplexity",
              "prime-intellect": "Prime Intellect",
              xiaomi: "Xiaomi",
              xai: "xAI",
              zai: "Zai",
            };

            return sortedKeys.map((key) => (
              <ModelSelectorGroup
                heading={
                  key === "_available"
                    ? "Available"
                    : (providerNames[key] ?? key)
                }
                key={key}
              >
                {grouped[key].map(({ model, curated }) => {
                  const logoProvider = model.id.split("/")[0];
                  return (
                    <ModelSelectorItem
                      className={cn(
                        "flex w-full",
                        model.id === selectedModel.id &&
                          "border-b border-dashed border-foreground/50",
                        !curated && "opacity-40 cursor-default"
                      )}
                      key={model.id}
                      onSelect={() => {
                        if (!curated) {
                          return;
                        }
                        onModelChange?.(model.id);
                        setCookie("chat-model", model.id);
                        setOpen(false);
                        setTimeout(() => {
                          document
                            .querySelector<HTMLTextAreaElement>(
                              "[data-testid='multimodal-input']"
                            )
                            ?.focus();
                        }, 50);
                      }}
                      value={model.id}
                    >
                      <ModelSelectorLogo provider={logoProvider} />
                      <ModelSelectorName>{model.name}</ModelSelectorName>
                      <div className="ml-auto flex items-center gap-2 text-foreground/70">
                        {capabilities?.[model.id]?.tools && (
                          <WrenchIcon className="size-3.5" />
                        )}
                        {capabilities?.[model.id]?.vision && (
                          <EyeIcon className="size-3.5" />
                        )}
                        {capabilities?.[model.id]?.reasoning && (
                          <BrainIcon className="size-3.5" />
                        )}
                        {!curated && (
                          <LockIcon className="size-3 text-muted-foreground/50" />
                        )}
                      </div>
                    </ModelSelectorItem>
                  );
                })}
              </ModelSelectorGroup>
            ));
          })()}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

export const ModelSelectorCompact = memo(PureModelSelectorCompact);
