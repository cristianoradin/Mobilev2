/**
 * ICON_REGISTRY — mesma lista do portal. Permite template salvar
 * display.icon = "BarChart3" + PWA renderizar o componente lucide.
 */
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

/** Fallback inteligente baseado em chart_type */
export function defaultIconForChart(chartType: string): LucideIcon {
  const map: Record<string, LucideIcon> = {
    line: LineChart, area: TrendingUp, bar: BarChart3, pie: PieChart,
    gauge: Gauge, report: TableProperties, kpi: Activity, heatmap: BarChart3,
    waterfall: BarChart3, button: Zap, tank: Fuel, multiblock: LayoutDashboard,
  }
  return map[chartType] ?? BarChart3
}
