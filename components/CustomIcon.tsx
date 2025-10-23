'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Phone,
  Mail,
  Clock,
  Shield,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  MessageSquare,
  Target,
  Zap,
  Wallet,
  HelpCircle,
} from 'lucide-react';

/**
 * Поддерживаем две схемы пропсов:
 * 1) Новая (используется ServiceIcon): src + fallbackIcon (+ alt?, className?, style?, title?)
 * 2) Старая (используется секциями): name (+ className?, style?, title?, alt?)
 */

// Новая схема
type CustomIconBySrc = {
  src: string;
  fallbackIcon: React.ElementType;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

// Старая схема
type LegacyIconName =
  | 'phone'
  | 'email'
  | 'warning'
  | 'urgent'
  | 'consultation'
  | 'guarantee'
  | 'target'
  | 'fast'
  | 'money'
  | 'shield'
  | 'hours';

type CustomIconByName = {
  name: LegacyIconName | string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  alt?: string;
};

type CustomIconProps = CustomIconBySrc | CustomIconByName;

// Регистр иконок: отображаем legacy name → { src, fallback }
const ICON_BASE = '/icons';

const iconRegistry: Record<string, { src: string; fallback: React.ElementType; alt?: string }> = {
  phone: { src: `${ICON_BASE}/phone.svg`, fallback: Phone, alt: 'Телефон' },
  email: { src: `${ICON_BASE}/email.svg`, fallback: Mail, alt: 'Email' },
  hours: { src: `${ICON_BASE}/hours.svg`, fallback: Clock, alt: 'Режим работы' },
  shield: { src: `${ICON_BASE}/shield.svg`, fallback: Shield, alt: 'Щит' },
  guarantee: { src: `${ICON_BASE}/guarantee.svg`, fallback: ShieldCheck, alt: 'Гарантия' },
  warning: { src: `${ICON_BASE}/warning.svg`, fallback: AlertTriangle, alt: 'Предупреждение' },
  urgent: { src: `${ICON_BASE}/urgent.svg`, fallback: AlertOctagon, alt: 'Срочно' },
  consultation: { src: `${ICON_BASE}/consultation.svg`, fallback: MessageSquare, alt: 'Консультация' },
  target: { src: `${ICON_BASE}/target.svg`, fallback: Target, alt: 'Цель' },
  fast: { src: `${ICON_BASE}/fast.svg`, fallback: Zap, alt: 'Быстро' },
  money: { src: `${ICON_BASE}/money.svg`, fallback: Wallet, alt: 'Выгодно' },
};

// Безопасное разрешение legacy имени
function resolveLegacy(name: string): { src: string; Fallback: React.ElementType; alt?: string } {
  const key = name?.trim().toLowerCase();
  const found = iconRegistry[key];
  if (found) return { src: found.src, Fallback: found.fallback, alt: found.alt };
  // Фолбэк по умолчанию на неизвестные значения
  return {
    src: `${ICON_BASE}/${key || 'unknown'}.svg`,
    Fallback: HelpCircle,
    alt: key || 'icon',
  };
}

function isBySrc(props: CustomIconProps): props is CustomIconBySrc {
  return (props as CustomIconBySrc).src !== undefined;
}

const CustomIcon: React.FC<CustomIconProps> = (props) => {
  // Унифицированные параметры для отрисовки
  const { src, Fallback, alt, className, style, title } = useMemo(() => {
    if (isBySrc(props)) {
      const { src, fallbackIcon, alt, className, style, title } = props;
      return {
        src,
        Fallback: fallbackIcon,
        alt: alt ?? 'icon',
        className,
        style,
        title,
      };
    }
    const { name, className, style, title, alt } = props;
    const { src, Fallback, alt: registryAlt } = resolveLegacy(name);
    return {
      src,
      Fallback,
      alt: alt ?? registryAlt ?? name,
      className,
      style,
      title,
    };
  }, [props]);

  const [error, setError] = useState(false);

  // Сбрасываем ошибку при смене источника
  useEffect(() => {
    setError(false);
  }, [src]);

  // Предостережение, если нет Fallback
  useEffect(() => {
    if (!Fallback) {
      // eslint-disable-next-line no-console
      console.warn(`[CustomIcon] fallbackIcon отсутствует для src="${src}". Будет отрендерен пустой span.`);
    }
  }, [Fallback, src]);

  if (!Fallback) {
    return <span className={className} style={style} aria-hidden="true" title={title} />;
  }

  if (error) {
    return <Fallback className={className} style={style} title={title} />;
  }

  return (
    <img
      src={src}
      alt={alt || 'icon'}
      className={className}
      style={style}
      title={title}
      onError={() => setError(true)}
      onLoad={() => setError(false)}
    />
  );
};

// Экспорт по умолчанию и именованный — для совместимости с разными стилями импорта
export default CustomIcon;
export { CustomIcon };