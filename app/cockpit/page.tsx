import type { Metadata } from 'next';
import CockpitApp from '@/components/CockpitApp';

export const metadata: Metadata = {
  title: "Back-office · L'Étoile Filante & L'EDEN",
};

export default function CockpitPage() {
  return <CockpitApp />;
}
