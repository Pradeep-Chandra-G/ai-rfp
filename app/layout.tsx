import type { Metadata } from "next";
// Assuming you are using the npm package 'geist' and not 'next/font/google'
// based on the import style you used. If you installed 'geist', this is correct:
import { Geist, Geist_Mono } from "next/font/google"; 
import "./globals.css";
// 💡 NEW: Import the Toaster component from react-hot-toast
import { Toaster } from "react-hot-toast"; 

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "AI RFP Management System", // 💡 Updated Title
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
                {/* 💡 NEW: Add the Toaster component */}
                <Toaster 
                    position="top-right" 
                    reverseOrder={false} 
                    toastOptions={{
                        // Default toast settings for a clean look
                        style: {
                            borderRadius: '8px',
                            background: '#333',
                            color: '#fff',
                        },
                        // Specific style for success messages
                        success: {
                            duration: 3000,
                            style: { background: '#22C55E' } // Tailwind green-500
                        },
                        // Specific style for error messages
                        error: {
                            duration: 5000,
                            style: { background: '#EF4444' } // Tailwind red-500
                        }
                    }}
                />
                {children}
            </body>
        </html>
    );
}