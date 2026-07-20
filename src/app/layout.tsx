import type { Metadata } from 'next';
import { Lora, Poppins } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  weight: ['500', '600', '700'],
});

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['300', '400', '500'],
});

export const metadata: Metadata = {
  title: 'Design Firm Ops',
  description: 'Internal project management, procurement, and invoicing for Madison Ditton Interiors',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${poppins.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
