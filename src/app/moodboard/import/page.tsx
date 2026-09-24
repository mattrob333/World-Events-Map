import type { Metadata } from 'next';
import { ProfileImport } from '@/components/designer/ProfileImport';

export const metadata: Metadata = {
  title: 'Import your profile · dope.travel',
  robots: { index: false, follow: false },
};

export default function ProfileImportPage() {
  return <ProfileImport />;
}
