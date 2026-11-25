const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const money = (value) => currency.format(value)
export const prettyDate = (date) => longDate.format(new Date(date + 'T12:00'))
export const dateLabel = (date) => shortDate.format(new Date(date + 'T12:00'))

export function localDate(date = new Date()) {
  return [
    date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function shiftDate(date, days) {
  const next = new Date(date + 'T12:00')
  next.setDate(next.getDate() + days)
  return localDate(next)
}

export function upcomingTimes(times, date, now = new Date()) {
  const today = localDate(now)
  if (date > today) return times
  if (date < today) return times && []
  const currentTime = now.toTimeString().slice(0, 5)
  return times?.filter((time) => time > currentTime)
}

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
