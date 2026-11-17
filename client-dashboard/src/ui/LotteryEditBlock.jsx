import React, { useState } from 'react';
import { formatCell } from '../format.js';

const AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/;
const COUNT_RE = /^\d+$/;

/**
 * Draft input text per field: the entered value, or '' when the field uses the POS figure.
 * @param {Array<{key: string, countKey?: string}>} rows
 * @param {Record<string, {value: any, edited: boolean}>} fields
 */
export function initialDraft(rows, fields) {
  const draft = {};
  for (const r of rows) {
    if (r.computed) continue;
    for (const key of [r.key, r.countKey].filter(Boolean)) {
      draft[key] = fields[key].edited ? String(fields[key].value ?? '') : '';
    }
  }
  return draft;
}

/**
 * Turns the draft into the PUT `values`: only fields whose entered value changes; '' = back to the POS figure
 * (null). Returns { values, errors } where errors maps field -> message.
 * @param {Record<string, string>} draft
 * @param {Record<string, {value: any, edited: boolean}>} fields
 * @param {Record<string, 'amount'|'count'>} kinds
 */
export function draftChanges(draft, fields, kinds) {
  const values = {};
  const errors = {};
  for (const [key, text] of Object.entries(draft)) {
    const t = String(text ?? '').trim();
    const current = fields[key].edited ? Number(fields[key].value) : null;
    if (t === '') {
      if (current !== null) values[key] = null;
      continue;
    }
    const ok = kinds[key] === 'count' ? COUNT_RE.test(t) : AMOUNT_RE.test(t);
    if (!ok) {
      errors[key] = kinds[key] === 'count' ? 'Whole number of tickets' : 'Dollar amount, at most 2 decimals';
      continue;
    }
    const n = Number(t);
    if (current === null || n !== current) values[key] = n;
  }
  return { values, errors };
}

function shown(field, kind) {
  if (kind === 'count')
    return field.value === null || field.value === undefined ? '' : formatCell(field.value, 'count');
  return formatCell(field.value, 'money');
}

function posText(field, kind) {
  if (field.pos === null || field.pos === undefined) return kind === 'count' ? '—' : '0.00';
  return kind === 'count' ? formatCell(field.pos, 'count') : formatCell(field.pos, 'money');
}

/**
 * A Daily report table (lottery, Safe Deposits) whose figures admin / staff can enter: one Edit button per
 * table, one Save. A value someone entered shows an "edited" mark and the POS figure in a small badge. An
 * empty input means "use the POS figure". A row with `computed: true` (e.g. Total deposits) shows `value`
 * and is never editable.
 */
export function LotteryEditBlock({
  title,
  note,
  rows,
  fields,
  kinds,
  canEdit,
  onSave,
  lastEdited,
  totalLabel,
  total,
  countLabel = 'tickets',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const hasCounts = rows.some((r) => r.countKey);

  const start = () => {
    setDraft(initialDraft(rows, fields));
    setErrors({});
    setMessage(null);
    setEditing(true);
  };

  const save = async () => {
    const { values, errors: errs } = draftChanges(draft, fields, kinds);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (Object.keys(values).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await onSave(values);
      setEditing(false);
    } catch (e) {
      setMessage(
        e?.code === 'VERSION_CONFLICT'
          ? 'Someone else saved this day while you were editing. Their figures are now shown; check them and edit again.'
          : e?.detail || 'The figures could not be saved. Try again.',
      );
      if (e?.code === 'VERSION_CONFLICT') setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const input = (key) => {
    const kind = kinds[key];
    const field = fields[key];
    return (
      <span className="lottery-edit__field">
        <input
          type="text"
          inputMode={kind === 'count' ? 'numeric' : 'decimal'}
          className={`control-input mono lottery-edit__input ${errors[key] ? 'lottery-edit__input--error' : ''}`}
          value={draft[key] ?? ''}
          placeholder={posText(field, kind)}
          aria-label={`${key.replace(/_/g, ' ')}${kind === 'count' ? '' : ' amount'}`}
          aria-invalid={Boolean(errors[key])}
          title={errors[key] || 'Leave empty to use the POS figure'}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          disabled={saving}
        />
        {draft[key] !== '' && (
          <button
            type="button"
            className="lottery-edit__reset"
            onClick={() => setDraft((d) => ({ ...d, [key]: '' }))}
            disabled={saving}
            title="Use the POS figure again"
          >
            Reset to POS
          </button>
        )}
      </span>
    );
  };

  const view = (key) => {
    const field = fields[key];
    const kind = kinds[key];
    return (
      <>
        {shown(field, kind)}
        {field.edited && (
          <span className="lottery-edit__badge" title="Figure from the POS">
            POS {posText(field, kind)}
          </span>
        )}
      </>
    );
  };

  return (
    <div className="table-card daily-report">
      <div className="table-header-title">
        <div>
          <h3>{title}</h3>
          {note && <div className="table-note">{note}</div>}
          {lastEdited && <div className="table-note lottery-edit__last">{lastEdited}</div>}
        </div>
        {canEdit && (
          <div className="table-actions">
            {editing ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={start}>
                Edit
              </button>
            )}
          </div>
        )}
      </div>
      {message && (
        <div className="lottery-edit__message" role="alert">
          {message}
        </div>
      )}
      <table className="daily-report__table">
        <tbody>
          {rows.map((r) =>
            r.computed ? (
              <tr key={r.key} className="lottery-edit__row--computed">
                <th scope="row">{r.label}</th>
                <td className={`daily-report__symbol daily-report__symbol--${r.tone || 'plain'}`}>{r.symbol}</td>
                <td className="mono">{formatCell(r.value, 'money')}</td>
                {hasCounts && <td className="daily-report__count" />}
              </tr>
            ) : (
              <tr key={r.key} className={fields[r.key].edited ? 'lottery-edit__row--edited' : undefined}>
                <th scope="row">
                  {r.label}
                  {fields[r.key].edited && !editing && <span className="lottery-edit__mark">edited</span>}
                </th>
                <td className={`daily-report__symbol daily-report__symbol--${r.tone || 'plain'}`}>{r.symbol}</td>
                <td className="mono">{editing ? input(r.key) : view(r.key)}</td>
                {hasCounts && (
                  <td className="daily-report__count">
                    {r.countKey &&
                      (editing ? (
                        input(r.countKey)
                      ) : fields[r.countKey].value !== null ? (
                        <>
                          {view(r.countKey)} {countLabel}
                        </>
                      ) : null)}
                  </td>
                )}
              </tr>
            ),
          )}
          {editing && Object.keys(errors).length > 0 && (
            <tr>
              <td colSpan={hasCounts ? 4 : 3} className="lottery-edit__errors">
                {Object.entries(errors).map(([k, m]) => (
                  <div key={k}>
                    {k.replace(/_/g, ' ')}: {m}
                  </div>
                ))}
              </td>
            </tr>
          )}
        </tbody>
        {totalLabel && (
          <tfoot>
            <tr>
              <th scope="row">{totalLabel}</th>
              <td className="daily-report__symbol">$</td>
              <td className="mono">{formatCell(total, 'money')}</td>
              {hasCounts && <td className="daily-report__count" />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
export default LotteryEditBlock;
