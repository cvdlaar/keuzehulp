import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AdminLayout from "@/components/AdminLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Keuzehulp Admin",
  description: "Assortiment beheer voor de keuzehulp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full bg-gray-50 text-gray-900">
        <AdminLayout>{children}</AdminLayout>
      </body>
    </html>
  );
}
