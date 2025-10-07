'use client';

/**
 * A clean, centered row of poker suits (♠ ♥ ♣ ♦), all the same visual size.
 * Pure black by default, subtle hover lift. No external deps.
 */
export default function SuitRow() {
  return (
    <div className="suit-row" aria-hidden>
      <Spade />
      <Heart />
      <Club />
      <Diamond />
      <style jsx>{`
        .suit-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin-bottom: 14px; /* spacing above the card */
        }
        .suit {
          width: 28px;
          height: 28px;
          fill: #0f172a;         /* onyx/ink – matches your UI */
          transition: transform .15s ease, opacity .15s ease, fill .15s ease;
        }
        .suit:hover {
          transform: translateY(-1px);
          opacity: .95;
          fill: #111827;         /* tiny tint on hover */
        }
        @media (min-width: 1024px) {
          .suit { width: 32px; height: 32px; }
        }
      `}</style>
    </div>
  );
}

function Spade() {
  return (
    <svg className="suit" viewBox="0 0 24 24">
      {/* balanced spade with matching visual weight */}
      <path d="M12 2c3.8 3.7 8 6.9 8 11.1 0 2.6-2 4.6-4.6 4.6-1.2 0-2.3-.4-3.2-1.1.2 1.7 1.1 3.2 2.6 4.4H9.2c1.5-1.2 2.4-2.7 2.6-4.4-.9.7-2 .9-3.2 1.1C6 17.7 4 15.7 4 13.1 4 8.9 8.2 5.7 12 2z"/>
    </svg>
  );
}

function Heart() {
  return (
    <svg className="suit" viewBox="0 0 24 24">
      <path d="M12 21s-6.7-4.9-9.1-8.1C1.7 10.5 2.4 7.5 5.2 6c1.9-1 4.3-.5 5.8 1.1C12.5 5.5 15 5 16.8 6c2.8 1.5 3.5 4.5 2.3 6.9C18.7 16.1 12 21 12 21z"/>
    </svg>
  );
}

function Club() {
  return (
    <svg className="suit" viewBox="0 0 24 24">
      {/* club with stem; tuned so its footprint matches the others */}
      <path d="M12 9.2c.8-2 2.6-3.3 4.6-3.3 2.4 0 4.4 2 4.4 4.4s-2 4.4-4.4 4.4c-.3 0-.6 0-.9-.1.6.7.9 1.6.9 2.5 0 2.3-1.9 4.1-4.1 4.1s-4.1-1.8-4.1-4.1c0-.9.3-1.8.9-2.5-.3.1-.6.1-.9.1-2.4 0-4.4-2-4.4-4.4S5.4 5.9 7.8 5.9c2 0 3.8 1.3 4.6 3.3zM10.2 20h3.6c-.5-1-1-1.9-1.1-3l-.2-2.3h-.9l-.2 2.3c-.1 1.1-.6 2-1.2 3z"/>
    </svg>
  );
}

function Diamond() {
  return (
    <svg className="suit" viewBox="0 0 24 24">
      <path d="M12 2l7 10-7 10-7-10 7-10z"/>
    </svg>
  );
}
