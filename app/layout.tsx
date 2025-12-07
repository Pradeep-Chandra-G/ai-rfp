import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Navigation from "../components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI RFP Management System",
  description: "Automated RFP and Proposal Processing Pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navigation />
        <Toaster
          position="top-right"
          reverseOrder={false}
          toastOptions={{
            style: {
              borderRadius: "8px",
              background: "#333",
              color: "#fff",
            },
            success: {
              duration: 3000,
              style: { background: "#22C55E" },
            },
            error: {
              duration: 5000,
              style: { background: "#EF4444" },
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
