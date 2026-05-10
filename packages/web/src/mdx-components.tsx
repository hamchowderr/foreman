import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Image — zoomable by default in docs
    img: (props) => {
      // MDX img props include HTML Blob in src — coerce to string for Next Image
      const { src, ...rest } = props as React.ImgHTMLAttributes<HTMLImageElement>;
      return <ImageZoom {...rest} src={typeof src === "string" ? src : ""} />;
    },
    Callout,
    Card,
    Cards,
    Steps,
    Step,
    Tab,
    Tabs,
    Accordion,
    Accordions,
    TypeTable,
    File,
    Folder,
    Files,
    ImageZoom,
    InlineTOC,
    DynamicCodeBlock,
    ...components,
  };
}
