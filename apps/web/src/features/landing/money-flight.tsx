import { Banknote } from 'lucide-react';
import type { CSSProperties } from 'react';

export function MoneyFlight() {
  return (
    <div className="oh-money-flight" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => (
        <span
          className="oh-flying-note"
          key={index}
          style={
            {
              '--note-index': index,
              '--note-left': `${[3, 89, 8, 91, 2, 86, 49][index]}%`,
              '--note-top': `${[15, 25, 49, 68, 87, 95, 4][index]}%`,
              '--note-angle': `${[-24, 19, 32, -18, 14, -30, 12][index]}deg`,
            } as CSSProperties
          }
        >
          <Banknote strokeWidth={0.9} />
        </span>
      ))}
    </div>
  );
}
