"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { UIMessage } from "ai";
import { CheckCircle, ChevronLeftIcon, ChevronRightIcon, Copy, ExternalLink } from "lucide-react";
import type { ComponentProps, HTMLAttributes, JSX, ReactElement } from "react";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LinkSafetyConfig, LinkSafetyModalProps } from "streamdown";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "flex min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({ className, children, ...props }: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

interface MessageBranchContextType {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
}

const MessageBranchContext = createContext<MessageBranchContextType | null>(null);

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext);

  if (!context) {
    throw new Error("MessageBranch components must be used within MessageBranch");
  }

  return context;
};

type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

const _MessageBranch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}: MessageBranchProps) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = useCallback(
    (newBranch: number) => {
      setCurrentBranch(newBranch);
      onBranchChange?.(newBranch);
    },
    [onBranchChange],
  );

  const goToPrevious = useCallback(() => {
    const newBranch = currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const goToNext = useCallback(() => {
    const newBranch = currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const contextValue = useMemo<MessageBranchContextType>(
    () => ({
      branches,
      currentBranch,
      goToNext,
      goToPrevious,
      setBranches,
      totalBranches: branches.length,
    }),
    [branches, currentBranch, goToNext, goToPrevious],
  );

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div className={cn("grid w-full gap-2 [&>div]:pb-0", className)} {...props} />
    </MessageBranchContext.Provider>
  );
};

type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

const _MessageBranchContent = ({ children, ...props }: MessageBranchContentProps) => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = useMemo(
    () => (Array.isArray(children) ? children : [children]),
    [children],
  );

  // Use useEffect to update branches when they change
  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden",
      )}
      key={branch.key}
      {...props}
    >
      {branch}
    </div>
  ));
};

type MessageBranchSelectorProps = ComponentProps<typeof ButtonGroup>;

export const MessageBranchSelector = ({ className, ...props }: MessageBranchSelectorProps) => {
  const { totalBranches } = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
    return null;
  }

  return (
    <ButtonGroup
      className={cn(
        "[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md",
        className,
      )}
      orientation="horizontal"
      {...props}
    />
  );
};

type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export const MessageBranchPrevious = ({ children, ...props }: MessageBranchPreviousProps) => {
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  );
};

type MessageBranchNextProps = ComponentProps<typeof Button>;

export const MessageBranchNext = ({ children, ...props }: MessageBranchNextProps) => {
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  );
};

type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export const MessageBranchPage = ({ className, ...props }: MessageBranchPageProps) => {
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      className={cn("border-none bg-transparent text-muted-foreground shadow-none", className)}
      {...props}
    >
      {currentBranch + 1} of {totalBranches}
    </ButtonGroupText>
  );
};

type MessageResponseProps = ComponentProps<typeof Streamdown>;

const streamdownPlugins = { cjk, code, math, mermaid };

// Custom link renderer — breaks long URLs, adds hover transition
const StreamdownLink = ({
  href,
  children,
  node: _node,
  ...props
}: JSX.IntrinsicElements["a"] & { node?: unknown }) => (
  <a
    href={href}
    className="break-all cursor-pointer text-[#007AFF] underline underline-offset-2 decoration-[#007AFF]/40 transition-[text-decoration-color] hover:decoration-[#007AFF] dark:text-[#0A84FF] dark:decoration-[#0A84FF]/40 dark:hover:decoration-[#0A84FF]"
    {...props}
  >
    {children}
  </a>
);

// iOS-style action sheet for link safety confirmation
const StreamdownLinkModal = ({ isOpen, onClose, onConfirm, url }: LinkSafetyModalProps) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 900);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" />
      <div
        className="relative mx-auto mb-8 w-full max-w-[380px] space-y-2 px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* URL + actions card */}
        <div className="overflow-hidden rounded-[16px] bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-[#1C1C1E]/95">
          <div className="px-4 pb-3 pt-4">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8E8E93]">
              Link
            </p>
            <p className="line-clamp-3 break-all text-[13px] leading-[1.45] text-[#1C1C1E] dark:text-[#F2F2F7]">
              {url}
            </p>
          </div>
          <div className="h-px bg-[#E5E5EA] dark:bg-[#3A3A3C]" />
          <button
            className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5"
            onClick={onConfirm}
            type="button"
          >
            <ExternalLink className="size-[18px] shrink-0 text-[#007AFF]" />
            <span className="text-[16px] text-[#007AFF]">Open Link</span>
          </button>
          <div className="h-px bg-[#E5E5EA] dark:bg-[#3A3A3C]" />
          <button
            className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5"
            onClick={handleCopy}
            type="button"
          >
            {copied ? (
              <CheckCircle className="size-[18px] shrink-0 text-[#34C759]" />
            ) : (
              <Copy className="size-[18px] shrink-0 text-[#007AFF]" />
            )}
            <span
              className={cn(
                "text-[16px] transition-colors",
                copied ? "text-[#34C759]" : "text-[#007AFF]",
              )}
            >
              {copied ? "Copied!" : "Copy Link"}
            </span>
          </button>
        </div>
        {/* Cancel card */}
        <div className="overflow-hidden rounded-[16px] bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-[#1C1C1E]/95">
          <button
            className="w-full px-4 py-3.5 transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5"
            onClick={onClose}
            type="button"
          >
            <span className="text-[17px] font-semibold text-[#007AFF]">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Render paragraphs as <div> to avoid invalid HTML nesting when Streamdown's
// link-safety overlay (a block element) fires inside a <p>.
const streamdownComponents = {
  p: "div" as const,
  a: StreamdownLink,
};

const streamdownLinkSafety: LinkSafetyConfig = {
  enabled: true,
  onLinkCheck: (url: string) => url.startsWith("http://") || url.startsWith("https://"),
  renderModal: (props: LinkSafetyModalProps) => <StreamdownLinkModal {...props} />,
};

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      plugins={streamdownPlugins}
      components={streamdownComponents}
      linkSafety={streamdownLinkSafety}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

MessageResponse.displayName = "MessageResponse";

type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({ className, children, ...props }: MessageToolbarProps) => (
  <div className={cn("mt-4 flex w-full items-center justify-between gap-4", className)} {...props}>
    {children}
  </div>
);
