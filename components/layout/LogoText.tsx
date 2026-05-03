// Статичный логотип ДезТехЮг.
// Раньше был на framer-motion с прыгающими буквами, glow-эффектом и "дымом" —
// убрал по запросу заказчика (раздражает, отвлекает от работы в CRM).

const RED = '#e20819';
const GREEN = '#4cb032';

const LETTERS: { char: string; color: typeof RED | typeof GREEN }[] = [
  { char: 'Д', color: RED },
  { char: 'Е', color: RED },
  { char: 'З', color: RED },
  { char: 'Т', color: GREEN },
  { char: 'Е', color: GREEN },
  { char: 'Х', color: GREEN },
  { char: 'Ю', color: RED },
  { char: 'Г', color: RED },
];

export function LogoText() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center w-full">
        {LETTERS.map((l, i) => (
          <span
            key={i}
            className="font-bebas font-bold text-3xl tracking-wider"
            style={{ color: l.color }}
          >
            {l.char}
          </span>
        ))}
      </div>
      <span
        className="text-xs text-content-secondary mt-1 font-roboto-condensed tracking-wider text-center font-medium"
        style={{ letterSpacing: '0.05em' }}
      >
        ДЕЗИНФЕКЦИОННЫЕ ТЕХНОЛОГИИ - ЮГ
      </span>
    </div>
  );
}
