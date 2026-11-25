import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, ExternalLink } from 'lucide-react';
import { transferProtectedPdf } from '../services/protectedPdf';

function OfferCenter({ api, role, applications = [] }) {
  const [offers, setOffers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0 });
  const [summary, setSummary] = useState({});
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadOffers = async (page = pagination.page) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/offers?page=${page}&pageSize=20`);
      setOffers(data.data?.records || []);
      setPagination(data.data?.pagination || { page: 1, totalPages: 0 });
      setSummary(data.data?.summary || {});
      setLoadError('');
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not load offer letters.');
      toast.error(error.response?.data?.message || 'Could not load offer letters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOffers(); }, [role]);

  const availableApplications = useMemo(() => {
    const offeredIds = new Set(offers.map((offer) => String(offer.applicationId?._id || offer.applicationId)));
    return applications.filter((application) =>
      application.status === 'selected'
      && !offeredIds.has(String(application._id)));
  }, [applications, offers]);
  const statusCounts = useMemo(() => ({
    total: summary.total || 0,
    issued: summary.issued || 0,
    accepted: summary.accepted || 0,
    rejected: summary.rejected || 0,
  }), [summary]);

  const createOffer = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api.post('/offers', {
        applicationId: form.get('applicationId'),
        annualCtc: Number(form.get('annualCtc')),
        monthlyStipend: Number(form.get('monthlyStipend') || 0),
        designation: form.get('designation') || undefined,
        jobLocation: form.get('jobLocation') || undefined,
        joiningDate: form.get('joiningDate') || undefined,
        employmentType: form.get('employmentType') || undefined,
        reportingDetails: form.get('reportingDetails') || undefined,
        termsAndConditions: form.get('termsAndConditions') || undefined,
        authorizedSignatory: form.get('authorizedSignatory') || undefined,
      });
      event.currentTarget.reset();
      toast.success('Offer PDF generated. Issue it when ready.');
      await loadOffers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Offer could not be generated.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (offer, status) => {
    const confirmText = status === 'accepted'
      ? 'Accept this offer?'
      : status === 'rejected'
        ? 'Reject this offer?'
        : status === 'revoked'
          ? 'Revoke this offer?'
          : status === 'expired'
            ? 'Mark this offer as expired?'
            : 'Issue this offer to the student?';
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await api.patch(`/offers/${offer._id}/status`, { status });
      toast.success(`Offer ${status}.`);
      await loadOffers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Offer status could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const transferPdf = async (offer, download) => {
    await transferProtectedPdf({
      api,
      endpoint: `/offers/${offer._id}/pdf${download ? '?download=true' : ''}`,
      fileName: offer.privatePdf?.originalFileName || 'offer-letter.pdf',
      download,
      onError: toast.error,
      blockedMessage: 'The browser blocked the PDF viewer. Allow pop-ups and try again.',
      failureMessage: 'Offer PDF could not be opened.',
    });
  };

  if (loading) return <div className="card text-sm text-gray-500">Loading offer letters...</div>;

  return <div className="space-y-6">
    {role !== 'student' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card"><p className="text-sm text-gray-500">Total offers</p><p className="mt-1 text-2xl font-bold">{statusCounts.total}</p></div>
      <div className="card"><p className="text-sm text-gray-500">Issued</p><p className="mt-1 text-2xl font-bold">{statusCounts.issued}</p></div>
      <div className="card"><p className="text-sm text-gray-500">Accepted</p><p className="mt-1 text-2xl font-bold">{statusCounts.accepted}</p></div>
      <div className="card"><p className="text-sm text-gray-500">Rejected</p><p className="mt-1 text-2xl font-bold">{statusCounts.rejected}</p></div>
    </div>}
    {['recruiter', 'admin'].includes(role) && <form className="card grid gap-3 md:grid-cols-2" onSubmit={createOffer}>
      <div className="md:col-span-2"><h2 className="text-xl font-bold">Generate offer letter</h2><p className="mt-1 text-sm text-gray-500">Only selected applications without an existing offer can be chosen.</p></div>
      <select className="input md:col-span-2" name="applicationId" required defaultValue="">
        <option value="" disabled>Select selected candidate</option>
        {availableApplications.map((application) => <option key={application._id} value={application._id}>
          {application.studentId?.fullName || 'Student'} · {application.jobId?.title || 'Drive'}
        </option>)}
      </select>
      <input className="input" type="number" name="annualCtc" min="0" step="0.01" placeholder="Annual CTC (INR)" required />
      <input className="input" type="number" name="monthlyStipend" min="0" step="0.01" placeholder="Monthly stipend (optional)" />
      <input className="input" name="designation" placeholder="Designation (defaults to job title)" />
      <input className="input" name="jobLocation" placeholder="Work location (defaults to job location)" />
      <input className="input" type="date" name="joiningDate" aria-label="Joining date" />
      <select className="input" name="employmentType" defaultValue=""><option value="">Employment type from drive</option><option>Full-time</option><option>Internship</option><option>Contract</option></select>
      <input className="input md:col-span-2" name="authorizedSignatory" placeholder="Authorized signatory (optional)" />
      <textarea className="input md:col-span-2" name="reportingDetails" maxLength="2000" placeholder="Reporting details (optional)" />
      <textarea className="input md:col-span-2" name="termsAndConditions" maxLength="10000" placeholder="Terms and conditions (optional)" />
      <button className="btn-primary md:col-span-2" type="submit" disabled={busy || !availableApplications.length}>
        {busy ? 'Generating...' : availableApplications.length ? 'Generate private PDF' : 'No selected applications available'}
      </button>
    </form>}

    <section className="card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold">{role === 'student' ? 'Offers received' : 'Offer letters'}</h2><p className="text-sm text-gray-500">Private offer PDFs are available only to authorized users.</p></div>
        <button type="button" className="btn-secondary" onClick={loadOffers}>Refresh</button>
      </div>
      {loadError && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</p>}
      {!loadError && offers.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
        <thead><tr className="border-b text-gray-500"><th className="py-3 pr-4">Candidate</th><th className="pr-4">Company / Position</th><th className="pr-4">Annual CTC</th><th className="pr-4">Joining</th><th className="pr-4">Status</th><th className="pr-4">History</th><th>Actions</th></tr></thead>
        <tbody>{offers.map((offer) => <tr className="border-b align-top" key={offer._id}>
          <td className="py-3 pr-4">{offer.studentId?.fullName || 'Candidate'}<br /><span className="text-xs text-gray-500">{offer.studentId?.rollNumber || ''}</span></td>
          <td className="pr-4">{offer.companyId?.name || 'Company'}<br /><span className="text-xs text-gray-500">{offer.designation}</span></td>
          <td className="pr-4">{Number(offer.annualCtc).toLocaleString('en-IN')} INR</td>
          <td className="pr-4">{offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString() : 'To be confirmed'}</td>
          <td className="pr-4"><span className="badge-gray">{offer.status}</span></td>
          <td className="pr-4 text-xs">{(offer.statusHistory || []).map((item, index) => <div key={`${item.status}-${index}`}>{item.status} · {new Date(item.changedAt).toLocaleDateString()}</div>)}</td>
          <td><div className="flex flex-wrap gap-1">
            <button type="button" className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs" onClick={() => transferPdf(offer, false)}><ExternalLink size={13} /> View</button>
            <button type="button" className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs" onClick={() => transferPdf(offer, true)}><Download size={13} /> Download</button>
            {role === 'student' && offer.status === 'issued' && <><button type="button" className="btn-primary px-2 py-1 text-xs" disabled={busy} onClick={() => changeStatus(offer, 'accepted')}>Accept</button><button type="button" className="btn-danger px-2 py-1 text-xs" disabled={busy} onClick={() => changeStatus(offer, 'rejected')}>Reject</button></>}
            {['recruiter', 'admin'].includes(role) && offer.status === 'generated' && <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={busy} onClick={() => changeStatus(offer, 'issued')}>Issue</button>}
            {role === 'recruiter' && ['generated', 'issued'].includes(offer.status) && <button type="button" className="btn-danger px-2 py-1 text-xs" disabled={busy} onClick={() => changeStatus(offer, 'revoked')}>Revoke</button>}
            {role === 'admin' && ['generated', 'issued'].includes(offer.status) && <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={busy} onClick={() => changeStatus(offer, 'expired')}>Expire</button>}
            {role === 'admin' && offer.status !== 'revoked' && <button type="button" className="btn-danger px-2 py-1 text-xs" disabled={busy} onClick={() => changeStatus(offer, 'revoked')}>Revoke</button>}
          </div></td>
        </tr>)}</tbody>
      </table></div> : !loadError && <p className="py-8 text-center text-sm text-gray-500">No offer letters available.</p>}
      {pagination.totalPages > 1 && <div className="mt-4 flex items-center justify-between text-sm"><span>Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><button type="button" className="btn-secondary" disabled={pagination.page <= 1} onClick={() => loadOffers(pagination.page - 1)}>Previous</button><button type="button" className="btn-secondary" disabled={pagination.page >= pagination.totalPages} onClick={() => loadOffers(pagination.page + 1)}>Next</button></div></div>}
    </section>
  </div>;
}

export default OfferCenter;
