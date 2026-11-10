import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { TopBar } from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"] });
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Clinical Scribe",
  description: "An open-source AI medical scribe built on the Sully API.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <TopBar demo={isDemoMode()} user={user} />
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="mx-auto w-full max-w-[1200px] px-6 py-10 text-[14px] text-graphite">
          Built on the Sully API. Notes and codes are drafts for clinician review, not medical advice.
        </footer>
      </body>
    </html>
  );
}
