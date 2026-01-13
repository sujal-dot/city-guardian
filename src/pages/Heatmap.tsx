import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CrimeHeatmap } from '@/components/dashboard/CrimeHeatmap';

export default function Heatmap() {
  return (
    <DashboardLayout
      title="Safety Heatmap"
      subtitle="Interactive crime hotspot visualization"
    >
      <CrimeHeatmap />
    </DashboardLayout>
  );
}
