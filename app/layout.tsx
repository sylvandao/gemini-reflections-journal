import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { LanguageProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Gemini Reflections Journal',
  description: 'A secure, user-authenticated reflection and journaling web app with Firebase Authentication, Firestore persistence, Real-Time Live Voice Agent mode, Google Maps location pinning, and external notification alerts.',
  openGraph: {
    title: 'Gemini Reflections Journal',
    description: 'A secure, user-authenticated reflection and journaling web app with Firebase Authentication, Firestore persistence, Real-Time Live Voice Agent mode, Google Maps location pinning, and external notification alerts.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gemini Reflections Journal',
    description: 'A secure, user-authenticated reflection and journaling web app with Firebase Authentication, Firestore persistence, Real-Time Live Voice Agent mode, Google Maps location pinning, and external notification alerts.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
