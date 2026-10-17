import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Receipt printer setup",
  description: "Set up NileStock receipt printing on Android, iPhone, tablets and computers.",
  alternates: { canonical: "/printing" },
};

export default function PrintingGuide() {
  return (
    <main className="min-h-screen bg-[#f8faf9] px-4 py-10 text-[#13231c]">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[#dce5e0] bg-white p-6 shadow-sm sm:p-10">
        <a href="/" className="text-sm font-semibold text-emerald-700">← Back to NileStock</a>
        <p className="mt-8 text-xs font-bold uppercase tracking-widest text-emerald-700">NileStock · Printer help</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Print a receipt from your device</h1>
        <p className="mt-4 text-sm leading-6 text-[#52645b]">Open a completed sale or Receipt history, open the receipt, then tap Print. Choose the connection that matches your printer and device. You can reprint an existing receipt without recording another sale.</p>
        <div className="mt-8 space-y-7 text-sm leading-6 text-[#52645b] [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#13231c] [&_a]:font-semibold [&_a]:text-emerald-700 [&_a]:underline">
          <section>
            <h2>Android phone + portable Bluetooth printer</h2>
            <ol className="ml-5 list-decimal space-y-2">
              <li>Charge the printer, load thermal paper correctly, and turn it on.</li>
              <li>Pair it in Android Bluetooth settings. Use the PIN supplied in the printer manual.</li>
              <li>Install <a href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank" rel="noopener noreferrer">RawBT from Google Play</a>. Allow its printer permissions, select your printer inside RawBT, and print its test page.</li>
              <li>Open NileStock in Chrome. On the receipt tap Print → Android Bluetooth / print app. Choose 58 mm or 80 mm to match your paper.</li>
              <li>Tap Test print, then Open print app to send the actual receipt. If Android asks, allow NileStock to open RawBT.</li>
            </ol>
            <p className="mt-3">RawBT is an independent third-party print app with its own terms and pricing. The receipt is passed to the app on your phone. Pairing alone does not install a print service.</p>
          </section>
          <section>
            <h2>Direct Bluetooth LE</h2>
            <p>In a supported Chrome or Edge browser, choose Direct Bluetooth LE, tap Test print and select your ESC/POS receipt printer. Common receipt profiles are tried automatically. Advanced settings accept manufacturer-provided service and write-characteristic UUIDs. Bluetooth Classic-only printers will not appear in this chooser; use the Android print app or desktop serial route.</p>
          </section>
          <section>
            <h2>USB, laptop and desktop printing</h2>
            <p>For a printer installed in your operating system, choose Device / system printer and select it in the print dialog. Install the manufacturer's correct driver or print service first and confirm an operating-system test page works. Bluetooth, USB, Wi-Fi and network connections depend on the printer's driver.</p>
            <p className="mt-2">For compatible ESC/POS printers, Direct USB is available in supported browsers (an OTG adapter may be needed on Android). Desktop Bluetooth / serial supports serial ports exposed by a paired Bluetooth Classic or USB serial printer. Match the baud rate to the printer manual. If a USB driver blocks direct access, use system printing.</p>
          </section>
          <section>
            <h2>iPhone and iPad</h2>
            <p>Choose Device / system printer for a compatible AirPrint printer. For a printer that requires its own iOS app, use Share PDF on the receipt and open it in that app if supported. Generic Bluetooth receipt printers are not universally supported by iOS browsers; this update cannot make an incompatible printer work with an iPhone.</p>
          </section>
          <section>
            <h2>Paper, blank receipts and incomplete printing</h2>
            <ul className="ml-5 list-disc space-y-2">
              <li>Set Settings → Receipt paper to 58 mm, 80 mm or A4 for PDFs and system printing. Match the printer's paper size in the print dialog and turn off browser headers and footers.</li>
              <li>Direct thermal connections use their selected 58 mm / 80 mm width and plain-text ESC/POS output. Label printers using other command languages need their manufacturer's app. Original characters and the full design remain in the PDF.</li>
              <li>If paper feeds but stays blank, check that it is thermal paper and that its printable side faces the print head.</li>
              <li>If printing stops partway, check the paper, battery and connection. Inspect the printed receipt before retrying to avoid a duplicate.</li>
              <li>If no dialog or app opens, use Chrome on Android, permit external-app opening, or download/share the PDF to a compatible print app.</li>
            </ul>
          </section>
          <p className="rounded-xl bg-emerald-50 p-4 text-emerald-950">A “sent” message confirms only that receipt data was handed to the connection or print app. Always check the paper. No browser update can guarantee every printer, phone and connection combination.</p>
        </div>
      </article>
    </main>
  );
}
