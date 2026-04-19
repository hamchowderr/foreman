"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ZapIcon,
  Shield01Icon,
  Message01Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  ArrowDown01Icon,
  Tick01Icon,
  Tick02Icon,
  ServerStack01Icon,
  CloudIcon,
  BrainIcon,
  Search01Icon,
  ViewIcon,
  LockIcon,
  UserMultipleIcon,
  Cancel01Icon,
  SparklesIcon,
  Mail01Icon,
  Calendar01Icon,
  CreditCardIcon,
  File01Icon,
  PlayIcon,
  Rotate01Icon,
  TerminalIcon,
  GitBranchIcon,
  Menu01Icon,
  MultiplicationSignIcon,
  GlobeIcon,
  CpuIcon,
  DashboardSpeed01Icon,
  LinkSquare01Icon,
  Activity01Icon,
  ToolboxIcon,
  FilterIcon,
  ScanEyeIcon,
  SmartPhone01Icon,
  Key01Icon,
  IdIcon,
} from "@hugeicons/core-free-icons";
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function make(icon: unknown) {
  return function Icon(props: IconProps) {
    return (
      <HugeiconsIcon
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        icon={icon as any}
        size={24}
        strokeWidth={1.75}
        {...props}
      />
    );
  };
}

// Lucide-compatible drop-in names
export const Zap = make(ZapIcon);
export const Shield = make(Shield01Icon);
export const MessageSquare = make(Message01Icon);
export const ArrowRight = make(ArrowRight01Icon);
export const ArrowLeft = make(ArrowLeft01Icon);
export const ChevronDown = make(ArrowDown01Icon);
export const ChevronRight = make(ArrowRight01Icon);
export const Check = make(Tick01Icon);
export const CheckDouble = make(Tick02Icon);
export const Server = make(ServerStack01Icon);
export const Cloud = make(CloudIcon);
export const Brain = make(BrainIcon);
export const Search = make(Search01Icon);
export const Eye = make(ViewIcon);
export const Lock = make(LockIcon);
export const Users = make(UserMultipleIcon);
export const Ban = make(Cancel01Icon);
export const Sparkles = make(SparklesIcon);
export const Mail = make(Mail01Icon);
export const Calendar = make(Calendar01Icon);
export const CreditCard = make(CreditCardIcon);
export const FileText = make(File01Icon);
export const Play = make(PlayIcon);
export const RotateCcw = make(Rotate01Icon);
export const Terminal = make(TerminalIcon);
export const GitBranch = make(GitBranchIcon);
export const Menu = make(Menu01Icon);
export const X = make(MultiplicationSignIcon);
export const Globe = make(GlobeIcon);
export const Cpu = make(CpuIcon);
export const Gauge = make(DashboardSpeed01Icon);
export const ExternalLink = make(LinkSquare01Icon);
export const History = make(Activity01Icon);
export const Toolbox = make(ToolboxIcon);
export const Filter = make(FilterIcon);
export const ScanEye = make(ScanEyeIcon);
export const Phone = make(SmartPhone01Icon);
export const Key = make(Key01Icon);
export const IdCard = make(IdIcon);
