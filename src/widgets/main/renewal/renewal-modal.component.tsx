// Добавлено: модалка продления на странице подписки — срок и число устройств,
// как в боте. Оплата уходит на платёжную страницу, оттуда человек
// возвращается сюда же (бэкенд даёт ссылку подписки как адрес возврата).

import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Center,
    Group,
    Loader,
    Modal,
    Paper,
    Stack,
    Text,
    UnstyledButton
} from '@mantine/core'
import {
    IconAlertOctagon,
    IconAlertTriangle,
    IconGift,
    IconMinus,
    IconPlus
} from '@tabler/icons-react'
import { ReactNode, useEffect, useRef, useState } from 'react'

import { useAppConfig } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { devices as devicesText, money, months as monthsText, moscowDate } from './format'
import {
    createPayment,
    getRenewalOptions,
    RenewalApiError,
    IRenewalOptions,
    IUnbindDevice
} from './renewal-api'

interface IProps {
    onClose: () => void
    opened: boolean
}

// Пока жмут −/+, не дёргаем бэкенд на каждое нажатие (у страницы лимит запросов).
const DEVICES_DEBOUNCE_MS = 400

const deviceName = (device: IUnbindDevice, index: number) =>
    device.model || device.platform || `устройство ${index + 1}`

// Плашка в модалке: скидка, кто отключится, ошибка — одной высоты и вида.
// Ошибка (critical) — с красной рамкой, чтобы её не спутать с подсказками.
const Notice = ({
    children,
    color,
    critical = false,
    icon
}: {
    children: ReactNode
    color: string
    critical?: boolean
    icon: ReactNode
}) => (
    <Alert
        color={color}
        icon={icon}
        px="sm"
        py={8}
        radius="md"
        style={critical ? { border: '1px solid var(--mantine-color-red-7)' } : undefined}
        styles={{ wrapper: { alignItems: 'center' }, icon: { marginInlineEnd: 10 } }}
        variant="light"
    >
        <Text c={critical ? 'red.1' : undefined} lh={1.35} size="sm">
            {children}
        </Text>
    </Alert>
)

const ErrorNotice = ({ children }: { children: ReactNode }) => (
    <Notice color="red" critical icon={<IconAlertOctagon size={18} />}>
        {children}
    </Notice>
)

export const RenewalModal = ({ opened, onClose }: IProps) => (
    <Modal
        centered
        onClose={onClose}
        opened={opened}
        radius="lg"
        size="md"
        title={
            <Text fw={700} size="lg">
                Продление подписки
            </Text>
        }
    >
        {/* Modal убирает содержимое, когда закрыт: открыли снова — свежие цены. */}
        <RenewalBody />
    </Modal>
)

const RenewalBody = () => {
    const { user } = useSubscription()
    const { brandingSettings } = useAppConfig()

    const [options, setOptions] = useState<IRenewalOptions | null>(null)
    const [devices, setDevices] = useState<number | null>(null)
    const [currentDevices, setCurrentDevices] = useState<number | null>(null)
    const [selectedMonths, setSelectedMonths] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [paying, setPaying] = useState(false)
    const [error, setError] = useState<null | string>(null)
    const cache = useRef(new Map<number, IRenewalOptions>())

    const load = async (count?: number) => {
        const cached = count === undefined ? undefined : cache.current.get(count)
        if (cached) {
            setOptions(cached)
            return
        }

        setLoading(true)
        setError(null)
        try {
            const result = await getRenewalOptions(user.shortUuid, count)
            cache.current.set(result.meta.devices, result)
            setOptions(result)
            if (count === undefined) {
                setDevices(result.meta.devices)
                setCurrentDevices(result.meta.devices)
            }
            setSelectedMonths((months) =>
                result.data.some((option) => option.months === months)
                    ? months
                    : (result.data[0]?.months ?? null)
            )
        } catch (e) {
            setError(e instanceof RenewalApiError ? e.message : 'Не получилось загрузить цены.')
        } finally {
            setLoading(false)
        }
    }

    // Открыли — цены за текущее число устройств.
    useEffect(() => {
        load()
    }, [])

    useEffect(() => {
        if (devices === null || devices === options?.meta.devices) return
        const timer = setTimeout(() => load(devices), DEVICES_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [devices])

    const pay = async () => {
        if (selectedMonths === null || devices === null) return
        setPaying(true)
        setError(null)
        try {
            window.location.href = await createPayment(user.shortUuid, selectedMonths, devices)
        } catch (e) {
            setError(e instanceof RenewalApiError ? e.message : 'Не получилось создать оплату.')
            setPaying(false)
        }
    }

    const meta = options?.meta
    const selected = options?.data.find((option) => option.months === selectedMonths)
    const trialDiscount = options?.data[0]?.trial_discount_percent ?? 0
    // Цены ещё за прошлое число устройств — платить по ним нельзя.
    const stale = loading || devices !== meta?.devices

    if (!options || !meta) {
        return error ? (
            <Stack gap="md">
                <ErrorNotice>{error}</ErrorNotice>
                <Button color="cyan" onClick={() => load()} radius="md" variant="filled">
                    Попробовать ещё раз
                </Button>
            </Stack>
        ) : (
            <Center py="xl">
                <Loader />
            </Center>
        )
    }

    if (meta.key_off) {
        return (
            <Stack gap="md">
                {/* Выключил админ или антиабуз (key_off_by) — человеку это одно и то же. */}
                <Text>
                    Ключ отключён, и оплата его не включит. Напишите в поддержку — разберёмся.
                </Text>
                {brandingSettings.supportUrl && (
                    <Button
                        color="cyan"
                        component="a"
                        href={brandingSettings.supportUrl}
                        radius="md"
                        rel="noopener noreferrer"
                        target="_blank"
                        variant="filled"
                    >
                        Написать в поддержку
                    </Button>
                )}
            </Stack>
        )
    }

    return (
        <Stack gap="md">
            <Paper p="sm" radius="md" withBorder>
                <Group justify="space-between" wrap="nowrap">
                    <Text fw={600}>Устройства</Text>
                    <Group gap="xs" wrap="nowrap">
                        <ActionIcon
                            aria-label="Меньше устройств"
                            disabled={devices === null || devices <= meta.min_devices}
                            onClick={() => setDevices((n) => (n === null ? n : n - 1))}
                            radius="md"
                            size="lg"
                            variant="light"
                        >
                            <IconMinus size={18} />
                        </ActionIcon>
                        <Text fw={700} miw={28} ta="center">
                            {devices}
                        </Text>
                        <ActionIcon
                            aria-label="Больше устройств"
                            disabled={devices === null || devices >= meta.max_devices}
                            onClick={() => setDevices((n) => (n === null ? n : n + 1))}
                            radius="md"
                            size="lg"
                            variant="light"
                        >
                            <IconPlus size={18} />
                        </ActionIcon>
                    </Group>
                </Group>
                {currentDevices !== null && devices !== currentDevices && (
                    <Text c="dimmed" mt="xs" size="xs">
                        После оплаты будет {devicesText(devices ?? 0)} (сейчас {currentDevices}).
                    </Text>
                )}
            </Paper>

            <Stack gap="xs" opacity={stale ? 0.5 : 1}>
                {options.data.map((option) => {
                    const isSelected = option.months === selectedMonths
                    const hasDiscount = option.full_amount !== option.amount
                    return (
                        <UnstyledButton
                            disabled={stale}
                            key={option.months}
                            onClick={() => setSelectedMonths(option.months)}
                        >
                            <Paper
                                p="sm"
                                radius="md"
                                style={{
                                    borderColor: isSelected
                                        ? 'var(--mantine-color-cyan-5)'
                                        : undefined,
                                    background: isSelected ? 'rgba(34, 184, 207, 0.08)' : undefined
                                }}
                                withBorder
                            >
                                <Group justify="space-between" wrap="nowrap">
                                    <Stack gap={0}>
                                        <Group gap={6}>
                                            <Text fw={600}>{monthsText(option.months)}</Text>
                                            {option.discount_percent > 0 && (
                                                <Badge color="teal" size="sm" variant="light">
                                                    −{option.discount_percent}%
                                                </Badge>
                                            )}
                                        </Group>
                                        {option.access_until && (
                                            <Text c="dimmed" size="xs">
                                                до {moscowDate(option.access_until)}
                                            </Text>
                                        )}
                                    </Stack>
                                    <Stack align="flex-end" gap={0}>
                                        <Text fw={700}>{money(option.amount)}</Text>
                                        {hasDiscount && (
                                            <Text c="dimmed" size="xs" td="line-through">
                                                {money(option.full_amount)}
                                            </Text>
                                        )}
                                    </Stack>
                                </Group>
                            </Paper>
                        </UnstyledButton>
                    )
                })}
            </Stack>

            {meta.unbind.length > 0 && !stale && (
                <Notice color="orange" icon={<IconAlertTriangle size={18} />}>
                    После оплаты отключатся последние подключённые:{' '}
                    <b>{meta.unbind.map(deviceName).join(', ')}</b>.
                </Notice>
            )}

            {error && <ErrorNotice>{error}</ErrorNotice>}

            {trialDiscount > 0 && (
                <Notice color="teal" icon={<IconGift size={18} />}>
                    Для вас скидка {trialDiscount}% на первую оплату — цены выше уже с ней.
                </Notice>
            )}

            <Button
                color="cyan"
                disabled={stale || !selected}
                fullWidth
                loading={paying}
                onClick={pay}
                radius="md"
                size="md"
                variant="filled"
            >
                {selected ? `Оплатить ${money(selected.amount)}` : 'Оплатить'}
            </Button>
        </Stack>
    )
}
