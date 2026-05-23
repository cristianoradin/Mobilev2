import {
  Fuel, BarChart3, LineChart, PieChart, Gauge, TableProperties,
  FileText, Users, Settings, Home, TrendingUp, TrendingDown,
  DollarSign, ShoppingCart, Truck, Package, AlertTriangle, Bell,
  CheckCircle, XCircle, Info, Shield, Clock, Calendar,
  RefreshCw, Download, Printer, Search, ArrowRight, ExternalLink,
  Droplets, Zap, LayoutDashboard, Key, Activity, Wifi, WifiOff,
  type LucideIcon,
} from 'lucide-react'

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Fuel, BarChart3, LineChart, PieChart, Gauge, TableProperties,
  FileText, Users, Settings, Home, TrendingUp, TrendingDown,
  DollarSign, ShoppingCart, Truck, Package, AlertTriangle, Bell,
  CheckCircle, XCircle, Info, Shield, Clock, Calendar,
  RefreshCw, Download, Printer, Search, ArrowRight, ExternalLink,
  Droplets, Zap, LayoutDashboard, Key, Activity, Wifi, WifiOff,
}

export type IconName = keyof typeof ICON_REGISTRY

export const ICON_NAMES = Object.keys(ICON_REGISTRY) as IconName[]

export function getIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null
  return ICON_REGISTRY[name] ?? null
}
