import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foreman",
  description: "AI assistant that helps you take actions across 10,000+ apps via Zapier",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved color theme preset before paint to avoid a flash. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: tiny inline theme bootstrap
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var v=localStorage.getItem('foreman:theme-preset');if(v&&v!=='default')document.documentElement.setAttribute('data-theme-preset',v);}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
