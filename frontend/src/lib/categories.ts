import type { CategoryBreakdownItem, SiteUsage } from '../types/dashboard'

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  social_media: { label: 'Social Media', color: '#ec4899' },
  video_streaming: { label: 'Video', color: '#8b5cf6' },
  gaming: { label: 'Gaming', color: '#f97316' },
  productivity: { label: 'Productivity', color: '#3b82f6' },
  education: { label: 'Education', color: '#10b981' },
  news: { label: 'News', color: '#eab308' },
  shopping: { label: 'Shopping', color: '#f43f5e' },
  communication: { label: 'Communication', color: '#06b6d4' },
  other: { label: 'Other', color: '#94a3b8' },
}

export function aggregateToCategoryList(
  timeByCategory: Record<string, number>,
  sites: SiteUsage[] = [],
): CategoryBreakdownItem[] {
  return Object.entries(timeByCategory)
    .filter(([, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, minutes]) => {
      const categorySites = sites
        .filter((s) => s.category === key && s.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes)
        .map((s) => ({ domain: s.domain, minutes: Math.round(s.minutes * 10) / 10 }))

      const attributed = categorySites.reduce((sum, s) => sum + s.minutes, 0)
      const total = Math.round(minutes * 10) / 10
      const unattributedMinutes = Math.max(0, Math.round((total - attributed) * 10) / 10)

      return {
        key,
        category: CATEGORY_META[key]?.label ?? key,
        minutes: total,
        color: CATEGORY_META[key]?.color ?? '#94a3b8',
        sites: categorySites,
        unattributedMinutes,
      }
    })
}
