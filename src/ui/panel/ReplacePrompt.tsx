import { strings } from '../strings';

export function ReplacePrompt({
  canSave,
  onSave,
  onDiscard,
  onStay,
}: {
  canSave: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
}) {
  return (
    <div className="banner" role="alertdialog" aria-label={strings.unsaved}>
      <p>{strings.unsaved}</p>
      <div className="actions">
        <button type="button" className="primary" disabled={!canSave} onClick={onSave}>
          {strings.save}
        </button>
        <button type="button" onClick={onDiscard}>
          {strings.discard}
        </button>
        <button type="button" onClick={onStay}>
          {strings.stay}
        </button>
      </div>
    </div>
  );
}
