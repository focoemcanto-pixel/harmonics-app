'use client';

import AdminShell from '../../components/admin/AdminShell';
import DashboardHero from '../../components/dashboard/DashboardHero';
import DashboardPrimaryKpis from '../../components/dashboard/DashboardPrimaryKpis';
import DashboardSecondaryKpis from '../../components/dashboard/DashboardSecondaryKpis';
import DashboardRevenueChart from '../../components/dashboard/DashboardRevenueChart';
import DashboardFinanceBreakdown from '../../components/dashboard/DashboardFinanceBreakdown';
import DashboardOperationsRadar from '../../components/dashboard/DashboardOperationsRadar';
import DashboardUpcomingEvents from '../../components/dashboard/DashboardUpcomingEvents';
import DashboardQuickActions from '../../components/dashboard/DashboardQuickActions';

export default function DashboardPage() {
  return (
    <AdminShell pageTitle="Dashboard" activeItem="dashboard">
      <div className="space-y-5">
        <DashboardHero />

        <DashboardPrimaryKpis />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
          <DashboardRevenueChart />
          <DashboardFinanceBreakdown />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.2fr]">
          <DashboardOperationsRadar />
          <DashboardUpcomingEvents />
        </div>

        <DashboardSecondaryKpis />

        <DashboardQuickActions />
      </div>
    </AdminShell>
  );
}
