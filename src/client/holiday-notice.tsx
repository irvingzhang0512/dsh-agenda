import { useAgenda } from './agenda-context.tsx'
export function HolidayNotice({ years }: { years: number[] }): React.ReactElement | null {
  const { snapshot } = useAgenda()
  if (!snapshot) return null
  const data = snapshot.holidayData
  const absent = [...new Set(years)].filter(year => !data.supportedYears.includes(year) && !data.localOverrideYears.includes(year))
  return absent.length ? <p className="da-dim">放假安排未载入（{absent.join('、')} 年），仅按普通工作日与周末显示。</p> : null
}
