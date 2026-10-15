import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/ui";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Fruit Shorts Studio",
  description: "Turn an idea into an edited, AI-animated fruit-character YouTube Short.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col lg:flex-row">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
