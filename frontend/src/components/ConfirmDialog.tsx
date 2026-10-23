import { createPortal } from 'react-dom'

interface Props {
  title: string
  children: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// В портале: backdrop-blur у карточек иначе ограничил бы fixed-окно размерами карточки.
function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Отмена',
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="card w-full max-w-md bg-slate-900">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-slate-300">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="btn bg-slate-700 hover:bg-slate-600" autoFocus>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={busy} className="btn bg-red-600 hover:bg-red-500">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ConfirmDialog
