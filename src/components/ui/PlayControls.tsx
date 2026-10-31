export type PlayProps = {
  playing: boolean;
  onPlay: () => void;
  onStep?: () => void;
  onReset: () => void;
  playLabel?: string;
};

const PLAY = <path d="M5 3.2v9.6c0 .5.6.8 1 .5l7.4-4.8a.6.6 0 0 0 0-1L6 2.7c-.4-.3-1 0-1 .5z" />;
const PAUSE = (
  <>
    <rect x="3.5" y="3" width="3" height="10" rx="1" />
    <rect x="9.5" y="3" width="3" height="10" rx="1" />
  </>
);
const STEP = <path d="M3.5 3.6v8.8c0 .5.5.7.9.5l6-4.4a.6.6 0 0 0 0-1l-6-4.4c-.4-.2-.9 0-.9.5zM11.5 3h1.5a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-1.5a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5z" />;
const RESET = <path d="M8 2.5a5.5 5.5 0 1 1-5.2 7.3.75.75 0 1 1 1.4-.5A4 4 0 1 0 5.2 5H7a.75.75 0 0 1 0 1.5H3.5a.75.75 0 0 1-.75-.75V2.25a.75.75 0 0 1 1.5 0v1.6A5.5 5.5 0 0 1 8 2.5z" />;

/** Transport: play/pause (labelled), step and reset as icon buttons. */
export default function PlayControls({ playing, onPlay, onStep, onReset, playLabel = "Play" }: PlayProps) {
  return (
    <div className="transport" role="group" aria-label="Playback">
      <button type="button" className="tbtn play" onClick={onPlay} aria-pressed={playing}>
        <svg viewBox="0 0 16 16" aria-hidden="true">{playing ? PAUSE : PLAY}</svg>
        <span className="tlabel">{playing ? "Pause" : playLabel}</span>
      </button>
      {onStep !== undefined && (
        <button type="button" className="tbtn" onClick={onStep} disabled={playing} aria-label="Step" title="Step">
          <svg viewBox="0 0 16 16" aria-hidden="true">{STEP}</svg>
        </button>
      )}
      <button type="button" className="tbtn" onClick={onReset} aria-label="Reset" title="Reset">
        <svg viewBox="0 0 16 16" aria-hidden="true">{RESET}</svg>
      </button>
    </div>
  );
}
