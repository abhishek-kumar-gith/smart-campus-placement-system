import { useState } from 'react';
import Modal from '../common/Modal';

function StudentAvatar({ student, size = 'small' }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const initials = String(student?.fullName || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const small = size === 'small';
  const imageUrl = student?.profilePhotoUrl || '';

  return <>
    {imageUrl && !broken
      ? <button type="button" className={`${small ? 'h-10 w-10' : 'h-24 w-24'} overflow-hidden rounded-full border border-slate-200 bg-slate-100`} onClick={() => { setLoaded(false); setOpen(true); }} aria-label={`View ${student.fullName || 'student'} profile photo`}>
          <img className="h-full w-full object-cover" src={imageUrl} alt={student.fullName || 'Student'} onError={() => setBroken(true)} />
        </button>
      : <button type="button" className={`${small ? 'h-10 w-10 text-xs' : 'h-24 w-24 text-lg'} flex items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700`} aria-label={`${student.fullName || 'Student'} has no profile photo`} disabled>{initials}</button>}
    <Modal open={open} title={`${student.fullName || 'Student'} - Profile Photo`} onClose={() => setOpen(false)}>
      <div className="flex min-h-64 items-center justify-center">
        {!loaded && <p className="text-sm text-gray-500">Loading full-size image...</p>}
        {imageUrl && <img className={`max-h-[70vh] max-w-full rounded-lg object-contain ${loaded ? '' : 'hidden'}`} src={imageUrl} alt={`${student.fullName || 'Student'} profile`} onLoad={() => setLoaded(true)} onError={() => { setLoaded(true); setBroken(true); setOpen(false); }} />}
      </div>
    </Modal>
  </>;
}

export default StudentAvatar;
