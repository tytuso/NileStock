import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store";

const SITE_URL = "https://nilestock.shop";
const DESCRIPTION =
  "NileStock is an affordable offline-ready POS and inventory system for shops, minimarts and growing retailers in Uganda and Africa. Sell from a phone, tablet or computer, generate receipts, barcodes, QR codes and business reports.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NileStock — POS & Inventory Software for Uganda",
    template: "%s | NileStock",
  },
  description: DESCRIPTION,
  applicationName: "NileStock",
  keywords: [
    "POS Uganda",
    "point of sale Uganda",
    "inventory software Uganda",
    "shop management software Uganda",
    "supermarket POS Uganda",
    "offline POS Uganda",
    "retail software Africa",
    "barcode POS",
    "mobile POS Uganda",
    "NileStock",
  ],
  authors: [{ name: "Nile AI Solutions" }],
  creator: "Nile AI Solutions",
  publisher: "Nile AI Solutions",
  category: "Business Software",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_UG",
    url: SITE_URL,
    siteName: "NileStock",
    title: "NileStock — POS & Inventory Software for Uganda",
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NileStock retail operating system for African shops",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NileStock — POS & Inventory Software for Uganda",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0d7a53",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Nile AI Solutions",
      url: SITE_URL,
      email: "hello@nileai.solutions",
      brand: { "@type": "Brand", name: "NileStock" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "NileStock",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Point of Sale and Inventory Management",
      operatingSystem: "Web browser, Android, iOS, Windows, macOS",
      description: DESCRIPTION,
      creator: { "@id": `${SITE_URL}/#organization` },
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "UGX" },
        { "@type": "Offer", name: "Lite", price: "9500", priceCurrency: "UGX" },
        { "@type": "Offer", name: "Business", price: "49500", priceCurrency: "UGX" },
        { "@type": "Offer", name: "Pro", price: "99500", priceCurrency: "UGX" },
      ],
      featureList: [
        "Point of sale",
        "Inventory management",
        "Offline-ready sales",
        "Barcode and QR code generation",
        "Printable and PDF receipts",
        "Customer credit",
        "Supplier and purchase tracking",
        "Staff shifts",
        "Business reports",
        "AI business adviser on Pro",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Can NileStock work on a phone?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. NileStock is a responsive web app for supported Android and iPhone browsers, tablets and desktop computers, and can be installed to the Home Screen as a PWA.",
          },
        },
        {
          "@type": "Question",
          name: "Can NileStock work without internet?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "After setup, the local workspace remains available during internet interruptions and pending changes sync when connectivity returns. Paid plans periodically reconnect to confirm the subscription; core selling and saved data remain protected if a verification window expires.",
          },
        },
        {
          "@type": "Question",
          name: "Does NileStock generate barcodes and QR codes?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. NileStock can create a product code and matching QR value automatically when the product code field is left blank.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need to buy a POS machine?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. NileStock can start on a phone, tablet or laptop. Receipt printers, cash drawers, barcode scanners and complete POS terminals are optional hardware purchased separately.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-UG" suppressHydrationWarning>
      <body>
        <AppProvider>{children}</AppProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
            if ('serviceWorker' in navigator) {
              addEventListener('load', () => {
                const localDev =
                  location.hostname === 'localhost' ||
                  location.hostname === '127.0.0.1' ||
                  location.hostname === '[::1]';

                if (localDev) {
                  navigator.serviceWorker
                    .getRegistrations()
                    .then((registrations) =>
                      Promise.all(
                        registrations.map((registration) =>
                          registration.unregister(),
                        ),
                      ),
                    )
                    .catch(() => {});

                  if ('caches' in window) {
                    caches
                      .keys()
                      .then((keys) =>
                        Promise.all(
                          keys
                            .filter((key) => key.startsWith('nilestock-'))
                            .map((key) => caches.delete(key)),
                        ),
                      )
                      .catch(() => {});
                  }

                  return;
                }

                navigator.serviceWorker
                  .register('/sw.js', { updateViaCache: 'none' })
                  .then((registration) => registration.update())
                  .catch(() => {});
              });
            }
          `,
          }}
        />
      </body>
    </html>
  );
}
