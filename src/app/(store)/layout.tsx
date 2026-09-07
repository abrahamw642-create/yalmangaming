import * as React from "react";

import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { Toaster, ToastProvider } from "@/components/layout/Toaster";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { CompareBar, CompareProvider } from "@/components/shop/CompareProvider";

/**
 * The storefront shell — the frame every `(store)` page renders inside.
 *
 * This layout stays a Server Component. Each interactive piece is a client
 * leaf, so the only JavaScript the frame costs is the chrome that genuinely
 * needs it (scroll state, dialogs, the cart) rather than the whole page tree.
 *
 * Landmarks: the root layout's "Skip to content" link targets `#main`, and this
 * layout owns that landmark. Pages render *inside* it and should not declare a
 * `<main>` of their own.
 *
 * Provider order matters. `ToastProvider` sits innermost so a toast can be
 * raised from anywhere inside the page tree, and the overlays that live outside
 * the document flow — the cart drawer, the compare tray, the WhatsApp float,
 * the search palette and the toast viewport — are mounted after `<Footer>` so
 * they portal above everything without being nested in a scroll container.
 */
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <CompareProvider>
        <ToastProvider>
          {/* A column so a short page still pins the footer to the bottom of
              the viewport instead of leaving a band of bare void under it. */}
          <div className="flex min-h-screen flex-col">
            <AnnouncementBar />
            <Navbar />

            <main id="main" className="flex-1">
              {children}
            </main>

            <Footer />
          </div>

          <CartDrawer />
          <CompareBar />
          <WhatsAppFloat />
          <SearchDialog />
          <Toaster />
        </ToastProvider>
      </CompareProvider>
    </CartProvider>
  );
}
