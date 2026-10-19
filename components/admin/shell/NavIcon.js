'use client';

import {
  Calculator,
  CalendarDays,
  Contact,
  FileText,
  LayoutDashboard,
  Link2,
  Music,
  Settings,
  Send,
  Sparkles,
  Star,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

const ICONS = { Calculator, CalendarDays, Contact, FileText, LayoutDashboard, Link2, Music, Settings, Send, Sparkles, Star, Users, Wallet, Zap };

export default function NavIcon({ name, size = 18, className = '' }) {
  const Icon = ICONS[name] || LayoutDashboard;
  return <Icon size={size} strokeWidth={1.9} className={className} aria-hidden="true" />;
}
