"use client";

import {
  Apple01Icon as HiAppleIcon,
  DiscordIcon as HiDiscordIcon,
  GithubIcon as HiGithubIcon,
  GoogleIcon as HiGoogleIcon,
  MicrosoftIcon as HiMicrosoftIcon,
  Notion01Icon as HiNotionIcon,
  SlackIcon as HiSlackIcon,
  StripeIcon as HiStripeIcon,
  TelegramIcon as HiTelegramIcon,
  TrelloIcon as HiTrelloIcon,
  TwitterIcon as HiTwitterIcon,
  WhatsappIcon as HiWhatsappIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { SVGProps } from "react";

type BrandProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  strokeWidth?: number;
  /** Override the default brand color */
  color?: string;
};

/**
 * Brand colors from each company's official brand guidelines.
 * Kept together so dark-mode adjustments happen in one place.
 */
export const BRAND_COLORS = {
  slack: "#611f69",
  discord: "#5865F2",
  telegram: "#26A5E4",
  github: "#24292f",
  githubDark: "#ffffff",
  whatsapp: "#25D366",
  microsoft: "#0078D4",
  google: "#4285F4",
  stripe: "#635BFF",
  trello: "#0079BF",
  notion: "#000000",
  notionDark: "#ffffff",
  twitter: "#1DA1F2",
  apple: "#000000",
  appleDark: "#ffffff",
  gmail: "#EA4335",
  linear: "#5E6AD2",
  zapier: "#FF4A00",
} as const;

function brand(icon: unknown, defaultColor: string) {
  return function BrandIcon({
    color = defaultColor,
    size = 24,
    strokeWidth = 1.75,
    ...rest
  }: BrandProps) {
    return (
      <HugeiconsIcon
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        icon={icon as any}
        color={color}
        size={size}
        strokeWidth={strokeWidth}
        {...rest}
      />
    );
  };
}

export const SlackBrand = brand(HiSlackIcon, BRAND_COLORS.slack);
export const DiscordBrand = brand(HiDiscordIcon, BRAND_COLORS.discord);
export const TelegramBrand = brand(HiTelegramIcon, BRAND_COLORS.telegram);
export const GithubBrand = brand(HiGithubIcon, BRAND_COLORS.github);
export const WhatsappBrand = brand(HiWhatsappIcon, BRAND_COLORS.whatsapp);
export const MicrosoftBrand = brand(HiMicrosoftIcon, BRAND_COLORS.microsoft);
export const GoogleBrand = brand(HiGoogleIcon, BRAND_COLORS.google);
export const StripeBrand = brand(HiStripeIcon, BRAND_COLORS.stripe);
export const TrelloBrand = brand(HiTrelloIcon, BRAND_COLORS.trello);
export const NotionBrand = brand(HiNotionIcon, BRAND_COLORS.notion);
export const TwitterBrand = brand(HiTwitterIcon, BRAND_COLORS.twitter);
export const AppleBrand = brand(HiAppleIcon, BRAND_COLORS.apple);
