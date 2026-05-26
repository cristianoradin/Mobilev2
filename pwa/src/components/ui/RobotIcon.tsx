/**
 * RobotIcon — SVG do robô usado pra status do agente.
 * Variantes:
 *   - online:    pulse animation + cor primary
 *   - offline:   sem animação + cinza
 *   - disconnected: pulse vermelho
 */
interface RobotIconProps {
  variant?: 'online' | 'offline' | 'disconnected'
  size?:    number
}

export function RobotIcon({ variant = 'online', size = 20 }: RobotIconProps) {
  const color =
    variant === 'online'       ? 'var(--c-primary)' :
    variant === 'disconnected' ? '#ef4444'           :
                                 'var(--c-rim2)'
  const animate = variant === 'online' || variant === 'disconnected'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="none"
      style={animate ? { animation: 'robotPulse 2s ease-in-out infinite' } : undefined}
    >
      {/* Antena */}
      <line x1="12" y1="3" x2="12" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="2" r="1.5" fill={color} />
      {/* Cabeça */}
      <rect x="6" y="6" width="12" height="11" rx="2" fill={color} />
      {/* Olhos brancos */}
      <circle cx="9.5"  cy="10" r="1.5" fill="white" />
      <circle cx="14.5" cy="10" r="1.5" fill="white" />
      {/* Pupilas */}
      <circle cx="9.5"  cy="10" r="0.7" fill="#1D1D1F" />
      <circle cx="14.5" cy="10" r="0.7" fill="#1D1D1F" />
      {/* Sorriso */}
      <path d="M8.5 13.5 Q12 15 15.5 13.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Sensores laterais */}
      <rect x="4"  y="9" width="2" height="4" rx="1" fill={color} />
      <rect x="18" y="9" width="2" height="4" rx="1" fill={color} />
      {/* Corpo */}
      <rect x="8" y="17" width="8" height="5" rx="1" fill={color} opacity="0.7" />
    </svg>
  )
}
