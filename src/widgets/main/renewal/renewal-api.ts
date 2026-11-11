// Добавлено: продление со страницы подписки. Те же ручки, что у бота и сайта
// (/api/renewal/options, /api/payments); человека бэкенд узнаёт по shortUuid
// из ссылки подписки в заголовке X-Subscription.

const API_URL = (import.meta.env.VITE_RENEWAL_API_URL ?? '').replace(/\/+$/, '')

export interface IRenewalOption {
    access_until: null | string
    amount: string
    discount_percent: number
    full_amount: string
    months: number
    trial_discount_percent: number
}

export interface IUnbindDevice {
    hwid: string
    model: null | string
    os_version: null | string
    platform: null | string
}

export interface IRenewalOptions {
    data: IRenewalOption[]
    meta: {
        devices: number
        key_off: boolean
        max_devices: number
        min_devices: number
        unbind: IUnbindDevice[]
    }
}

export class RenewalApiError extends Error {}

async function request<T>(shortUuid: string, path: string, init: RequestInit = {}): Promise<T> {
    let response: Response
    try {
        response = await fetch(`${API_URL}/api/${path}`, {
            ...init,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Subscription': shortUuid
            }
        })
    } catch {
        throw new RenewalApiError('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.')
    }

    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new RenewalApiError(
            body?.message && response.status !== 401
                ? body.message
                : 'Не получилось. Обновите страницу и попробуйте ещё раз.'
        )
    }

    return body as T
}

export const isRenewalAvailable = API_URL !== ''

export function getRenewalOptions(shortUuid: string, devices?: number): Promise<IRenewalOptions> {
    const query = devices === undefined ? '' : `?devices=${devices}`
    return request(shortUuid, `renewal/options${query}`)
}

export async function createPayment(
    shortUuid: string,
    months: number,
    devices: number
): Promise<string> {
    const { data } = await request<{ data: { confirmation_url: null | string } }>(
        shortUuid,
        'payments',
        { method: 'POST', body: JSON.stringify({ months, devices }) }
    )
    // Уходим только на https-страницу банка: не javascript: и не что-то ещё.
    if (!data.confirmation_url?.startsWith('https://')) {
        throw new RenewalApiError('Платёжная страница не открылась. Попробуйте ещё раз.')
    }

    return data.confirmation_url
}
