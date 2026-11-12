// Изменено относительно Remnawave 8.0.1: заменяет блок «expanded». Вместо имени пользователя и
// четырёх плашек — статус подписки словами, когда кончается, трафик (только
// если он ограничен, т. е. в пробном) и кнопка продления с модалкой.

import {
    Button,
    Card,
    Divider,
    Group,
    Progress,
    Stack,
    Text,
    ThemeIcon,
    Title
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconAlertCircle, IconCheck, IconX } from '@tabler/icons-react'
import { useState } from 'react'

import { useTranslation } from '@shared/hooks'
import { getColorGradientSolid, getExpirationTextUtil } from '@shared/utils/config-parser'

import { useSubscription } from '@entities/subscription-info-store'

import { isRenewalAvailable, RenewalModal } from '../renewal'

interface IProps {
    isMobile: boolean
}

// Сколько дней до конца — «скоро закончится» (как в боте: продлить, когда ≤ 3 дней).
const ENDING_DAYS = 3

// Уже этого — трафик и кнопка уходят под статус: в одну строку не влезают.
const COMPACT_QUERY = '(max-width: 48em)'

export const SubscriptionInfoExpandedWidget = ({ isMobile }: IProps) => {
    const { currentLang, baseTranslations } = useTranslation()
    const { user } = useSubscription()
    const [renewalOpened, setRenewalOpened] = useState(false)
    const compact =
        useMediaQuery(COMPACT_QUERY, undefined, { getInitialValueInEffect: false }) ?? isMobile

    const iconSize = isMobile ? 18 : 22

    const getStatus = (): { color: string; icon: React.ReactNode; title: string } => {
        switch (user.userStatus) {
            case 'ACTIVE':
                return user.daysLeft > ENDING_DAYS
                    ? {
                          color: 'teal',
                          icon: <IconCheck size={iconSize} />,
                          title: 'Подписка активна'
                      }
                    : {
                          color: 'orange',
                          icon: <IconAlertCircle size={iconSize} />,
                          title: 'Подписка скоро закончится'
                      }
            case 'LIMITED':
                return {
                    color: 'orange',
                    icon: <IconAlertCircle size={iconSize} />,
                    title: 'Трафик закончился'
                }
            case 'EXPIRED':
                return {
                    color: 'red',
                    icon: <IconX size={iconSize} />,
                    title: 'Подписка закончилась'
                }
            default:
                return {
                    color: 'red',
                    icon: <IconX size={iconSize} />,
                    title: 'Подписка не активна'
                }
        }
    }

    const status = getStatus()
    const trafficOut = user.userStatus === 'LIMITED'
    const gradient = getColorGradientSolid(status.color)
    const needsRenewal = status.color !== 'teal'

    // '0' — без лимита (оплаченная подписка): трафик не показываем.
    const limited = user.trafficLimit !== '0'
    // Доля израсходованного, 0–100: полоса заполняется по мере трафика.
    const usedPercent = limited
        ? Math.min(
              100,
              Math.max(
                  0,
                  (Number(user.trafficUsedBytes) / Number(user.trafficLimitBytes)) * 100 || 0
              )
          )
        : 0

    const traffic = limited && (
        <Stack gap={4} miw={compact ? undefined : 170}>
            <Group gap={6} justify="space-between" wrap="nowrap">
                <Text c="dimmed" fw={500} size="xs">
                    Трафик
                </Text>
                <Text c="white" fw={600} size="xs">
                    {user.trafficUsed} из {user.trafficLimit}
                </Text>
            </Group>
            <Progress
                color={usedPercent >= 90 ? 'red' : usedPercent >= 75 ? 'orange' : 'cyan'}
                radius="xl"
                size="sm"
                value={usedPercent}
            />
        </Stack>
    )

    const renewButton = isRenewalAvailable && (
        <Button
            color={needsRenewal ? 'cyan' : 'gray'}
            fullWidth={compact}
            onClick={() => setRenewalOpened(true)}
            radius="md"
            style={{ flexShrink: 0 }}
            variant={needsRenewal ? 'filled' : 'light'}
        >
            {compact ? 'Продлить подписку' : 'Продлить'}
        </Button>
    )

    return (
        <Card p={{ base: 'sm', xs: 'md', sm: 'lg', md: 'xl' }} radius="lg">
            <Stack gap={compact ? 'sm' : 'md'}>
                <Group gap="md" justify="space-between" wrap="nowrap">
                    <Group gap={isMobile ? 'xs' : 'md'} style={{ minWidth: 0 }} wrap="nowrap">
                        <ThemeIcon
                            color={status.color}
                            radius="xl"
                            size={isMobile ? 36 : 44}
                            style={{
                                background: gradient.background,
                                border: gradient.border,
                                boxShadow: gradient.boxShadow,
                                flexShrink: 0
                            }}
                            variant="light"
                        >
                            {status.icon}
                        </ThemeIcon>

                        <Stack gap={2} style={{ minWidth: 0 }}>
                            <Title
                                c="white"
                                fw={600}
                                order={5}
                                style={{ whiteSpace: compact ? undefined : 'nowrap' }}
                            >
                                {status.title}
                            </Title>
                            <Text
                                c={user.daysLeft === 0 ? 'red' : 'dimmed'}
                                fw={600}
                                size={isMobile ? 'xs' : 'sm'}
                            >
                                {/* Трафик кончился — VPN не работает, хотя дни остались:
                                    дата только запутает, говорим, что делать. */}
                                {trafficOut
                                    ? 'Продлите, чтобы VPN снова заработал'
                                    : getExpirationTextUtil(
                                          user.expiresAt,
                                          currentLang,
                                          baseTranslations
                                      )}
                            </Text>
                        </Stack>

                        {!compact && traffic && (
                            <>
                                <Divider mx="xs" orientation="vertical" />
                                {traffic}
                            </>
                        )}
                    </Group>

                    {!compact && renewButton}
                </Group>

                {compact && traffic}
                {compact && renewButton}
            </Stack>

            {isRenewalAvailable && (
                <RenewalModal onClose={() => setRenewalOpened(false)} opened={renewalOpened} />
            )}
        </Card>
    )
}
