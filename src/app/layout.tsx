import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gatehouse — Pre-flight LLM Gate Chain",
  description: "A pre-flight gate chain for LLM calls, wrapped in an assistant for professional-services users.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#FBFBF9] text-[#15181C]">
        {children}
      </body>
    </html>
  );
}
