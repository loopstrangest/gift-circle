"use client";

export type ItemDraft = {
  title: string;
  details: string;
};

type RoomItemFormProps = {
  draft: ItemDraft;
  heading: string;
  submitLabel: string;
  onChange: (draft: ItemDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

export function RoomItemForm({
  draft,
  heading,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
  disabled = false,
}: RoomItemFormProps) {
  return (
    <form
      className="section-card flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) {
          onSubmit();
        }
      }}
    >
      <h2 className="text-lg font-semibold text-brand-ink-900">{heading}</h2>
      <label className="flex flex-col gap-2 text-sm">
        <span className="form-label">Title</span>
        <input
          type="text"
          value={draft.title}
          maxLength={120}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          className="input-field"
          disabled={disabled}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="form-label">Details</span>
        <textarea
          value={draft.details}
          maxLength={1000}
          onChange={(event) => onChange({ ...draft, details: event.target.value })}
          className="min-h-[140px] input-field"
          disabled={disabled}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-gold" disabled={disabled}>
          {submitLabel}
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
