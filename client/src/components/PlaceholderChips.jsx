export default function PlaceholderChips({ placeholders, onInsert }) {
  if (!placeholders?.length) return null;

  return (
    <div className="placeholder-chips-wrap">
      <p className="muted small">Click to insert:</p>
      <div className="placeholder-chips">
        {placeholders.map((key) => (
          <button
            key={key}
            type="button"
            className="placeholder-chip"
            onClick={() => onInsert(key)}
          >
            {`{{${key}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}
