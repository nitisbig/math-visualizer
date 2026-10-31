type Props = {
  playing: boolean;
  onPlay: () => void;
  onStep?: () => void;
  onReset: () => void;
  playLabel?: string;
};

export default function PlayControls({ playing, onPlay, onStep, onReset, playLabel = "Play" }: Props) {
  return (
    <div className="ctl buttons">
      <button type="button" className="btn primary" onClick={onPlay} aria-pressed={playing}>
        {playing ? (
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="3" height="10" /><rect x="9" y="3" width="3" height="10" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
        )}
        {playing ? "Pause" : playLabel}
      </button>
      {onStep && (
        <button type="button" className="btn" onClick={onStep} disabled={playing}>
          Step
        </button>
      )}
      <button type="button" className="btn" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
