// Добавлено: деньги, даты по Москве и склонения — как в боте.

export function plural(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return one
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
    return many
}

export const months = (n: number) => `${n} ${plural(n, 'месяц', 'месяца', 'месяцев')}`

export const devices = (n: number) => `${n} ${plural(n, 'устройство', 'устройства', 'устройств')}`

// "433.00" → "433 ₽", "433.50" → "433,50 ₽"
export function money(amount: string): string {
    const value = Number(amount)
    return `${value.toLocaleString('ru-RU', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2
    })} ₽`
}

// «12 декабря 2026» — без «г.», которое добавляет toLocaleDateString.
export function moscowDate(iso: string): string {
    const parts = new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Moscow'
    }).formatToParts(new Date(iso))
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? ''

    return `${part('day')} ${part('month')} ${part('year')}`
}
