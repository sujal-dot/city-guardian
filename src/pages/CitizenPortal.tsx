import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SOSButton } from '@/components/citizen/SOSButton';
import { ComplaintForm } from '@/components/citizen/ComplaintForm';
import { ComplaintTracker } from '@/components/citizen/ComplaintTracker';
import { SafetyAlertDemo } from '@/components/citizen/SafetyAlert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, FileText, Search, Phone } from 'lucide-react';

export default function CitizenPortal() {
  return (
    <DashboardLayout
      title="Citizen Safety Portal"
      subtitle="Report incidents and access emergency services"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Safety Alert Demo */}
        <SafetyAlertDemo />

        {/* Emergency Section */}
        <div className="card-command p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive mb-4">
              <Phone className="h-4 w-4" />
              <span className="text-sm font-medium">Emergency Services</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Need Immediate Help?
            </h2>
            <p className="text-muted-foreground">
              Press the SOS button to alert authorities with your location
            </p>
          </div>
          <SOSButton />
        </div>

        {/* Tabs for Complaints */}
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              File Complaint
            </TabsTrigger>
            <TabsTrigger value="track" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Track Complaints
            </TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="mt-4">
            <ComplaintForm />
          </TabsContent>
          <TabsContent value="track" className="mt-4">
            <ComplaintTracker />
          </TabsContent>
        </Tabs>

        {/* Safety Tips */}
        <div className="card-command p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Safety Tips</h3>
              <p className="text-sm text-muted-foreground">Stay safe in your area</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              'Avoid poorly lit areas after dark',
              'Keep emergency numbers saved on speed dial',
              'Share your location with trusted contacts when traveling',
              'Report any suspicious activity immediately',
              'Stay aware of your surroundings',
              'Avoid using phones while walking in unfamiliar areas',
            ].map((tip, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                  {index + 1}
                </div>
                <span className="text-sm text-foreground">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
