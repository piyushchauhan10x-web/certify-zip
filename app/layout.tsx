import './globals.css';
import { Sora, Inter } from 'next/font/google';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', weight: ['600', '700'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['400', '500'] });

export const metadata = {
  title: 'Certify — Zero-Upload Certificate Engine',
  description: 'Privacy-first bulk certificate generator, browser-side.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body className="bg-bg text-text font-body">{children}</body>
    </html>
  );
}