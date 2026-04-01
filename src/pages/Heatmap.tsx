import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EnhancedCrimeMap } from '@/components/map/EnhancedCrimeMap';

export default function Heatmap() {
  return (
    <DashboardLayout
      title="Safety Heatmap"
      subtitle="Interactive crime hotspot visualization"
    >
      <EnhancedCrimeMap />
    </DashboardLayout>
  );
}
