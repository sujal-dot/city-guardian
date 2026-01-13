import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CrimeMap } from '@/components/map/CrimeMap';

export default function Heatmap() {
  return (
    <DashboardLayout
      title="Safety Heatmap"
      subtitle="Interactive crime hotspot visualization"
    >
      <CrimeMap />
    </DashboardLayout>
  );
}
