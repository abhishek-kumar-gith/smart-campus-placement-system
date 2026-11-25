function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b px-6 py-4"><h2 className="text-lg font-bold">{title}</h2><button type="button" className="text-2xl text-gray-400 hover:text-gray-700" onClick={onClose} aria-label="Close">&times;</button></div>
      <div className="p-6">{children}</div>
    </div>
  </div>;
}

export default Modal;
