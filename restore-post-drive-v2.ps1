$ErrorActionPreference = 'Stop'
$target = Join-Path (Get-Location) 'frontend\src\RecruiterDashboard.jsx'
if (-not (Test-Path $target)) { throw "Run from D:\campusPlacementSystem project root." }

$content = [System.IO.File]::ReadAllText($target)
if ($content.Contains('const createDrive = async (event) =>')) {
  Write-Host "createDrive handler already exists. No changes made." -ForegroundColor Yellow
  exit 0
}

$stateAnchor = '  const [resumeBusy, setResumeBusy] = useState({});'
if (-not $content.Contains($stateAnchor)) { throw "State anchor not found. No changes made." }
$content = $content.Replace($stateAnchor, $stateAnchor + "`r`n  const [showDriveForm, setShowDriveForm] = useState(false);")

$functionAnchor = '  const scheduleInterview = async (event) => {'
if (-not $content.Contains($functionAnchor)) { throw "scheduleInterview anchor not found. No changes made." }

$functionCode = @'
  const createDrive = async (event) => {
    event.preventDefault();
    if (profile?.approvalStatus !== 'approved') {
      toast.error('Your recruiter account must be approved before posting a drive.');
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const publishDate = new Date(`${form.get('publishDate')}T00:00:00`);
    const applicationDeadline = new Date(`${form.get('applicationDeadline')}T23:59:59`);

    if (Number.isNaN(publishDate.getTime()) || Number.isNaN(applicationDeadline.getTime())) {
      toast.error('Please enter valid dates.');
      return;
    }
    if (applicationDeadline <= new Date()) {
      toast.error('Application deadline must be in the future.');
      return;
    }
    if (applicationDeadline < publishDate) {
      toast.error('Application deadline cannot be earlier than publish date.');
      return;
    }

    const packageMin = form.get('packageMin');
    const packageMax = form.get('packageMax');
    const targetSemester = form.get('targetSemester');
    const allowedSemesters = form.getAll('allowedSemesters').map(Number);
    const payload = {
      title: String(form.get('title')).trim(),
      description: String(form.get('description')).trim(),
      location: String(form.get('location')).trim(),
      jobType: form.get('jobType'),
      requiredExperience: String(form.get('requiredExperience') || '').trim(),
      package: {
        min: packageMin === '' ? 0 : Number(packageMin),
        max: packageMax === '' ? 0 : Number(packageMax),
        currency: 'INR',
      },
      requiredSkills: String(form.get('requiredSkills') || '').split(',').map((skill) => skill.trim()).filter(Boolean),
      minCgpa: Number(form.get('minCgpa') || 0),
      allowedBranches: form.getAll('allowedBranches'),
      targetGraduationYear: Number(form.get('targetGraduationYear')),
      maxBacklogs: Number(form.get('maxBacklogs') || 0),
      vacancies: Number(form.get('vacancies')),
      publishDate: publishDate.toISOString(),
      applicationDeadline: applicationDeadline.toISOString(),
    };
    if (targetSemester) payload.targetSemester = Number(targetSemester);
    if (allowedSemesters.length) payload.allowedSemesters = allowedSemesters;

    if (!payload.allowedBranches.length) {
      toast.error('Select at least one eligible branch.');
      return;
    }
    if (payload.package.max > 0 && payload.package.min > payload.package.max) {
      toast.error('Minimum package cannot exceed maximum package.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/jobs', payload);
      toast.success('Drive submitted for Placement Officer approval.');
      formElement.reset();
      setShowDriveForm(false);
      const jobsResponse = await api.get('/jobs?all=true');
      setJobs(jobsResponse.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Could not submit drive.');
    } finally {
      setBusy(false);
    }
  };

'@
$content = $content.Replace($functionAnchor, $functionCode + $functionAnchor)

$lines = [System.Collections.Generic.List[string]]::new()
[System.IO.File]::ReadAllLines($target) | ForEach-Object { [void]$lines.Add($_) }
$driveIndexes = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i].Contains("{tab === 'drives' &&")) { $driveIndexes += $i }
}
if ($driveIndexes.Count -ne 1) { throw "Expected exactly one My Drives JSX line; found $($driveIndexes.Count). No file written." }

$indent = ([regex]::Match($lines[$driveIndexes[0]], '^\s*')).Value
$newDrives = @'
{tab === 'drives' && <div className="card">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-xl font-bold">My Drives</h2>
    {profile?.approvalStatus === 'approved'
      ? <button type="button" className="btn-primary" onClick={() => setShowDriveForm((value) => !value)}>{showDriveForm ? 'Close Form' : '+ Post Drive'}</button>
      : <span className="text-sm text-amber-700">Drive posting unlocks after recruiter approval.</span>}
  </div>
  {showDriveForm && profile?.approvalStatus === 'approved' && <form className="mb-6 space-y-4 rounded-xl border p-4" onSubmit={createDrive}>
    <div><h3 className="text-lg font-semibold">Post a Placement Drive</h3><p className="text-sm text-gray-500">Your drive will be submitted for Placement Officer approval.</p></div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1 text-sm font-medium">Job title<input className="input" name="title" minLength="2" required /></label>
      <label className="space-y-1 text-sm font-medium">Location<input className="input" name="location" minLength="2" required /></label>
      <label className="space-y-1 text-sm font-medium">Job type<select className="input" name="jobType"><option>Full-time</option><option>Internship</option><option>Contract</option></select></label>
      <label className="space-y-1 text-sm font-medium">Required experience<input className="input" name="requiredExperience" placeholder="Fresher / 0-1 years" /></label>
      <label className="space-y-1 text-sm font-medium">Minimum package (INR/year)<input className="input" name="packageMin" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label className="space-y-1 text-sm font-medium">Maximum package (INR/year)<input className="input" name="packageMax" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label className="space-y-1 text-sm font-medium">Minimum CGPA<input className="input" name="minCgpa" type="number" min="0" max="10" step="0.01" defaultValue="0" required /></label>
      <label className="space-y-1 text-sm font-medium">Target graduation year<input className="input" name="targetGraduationYear" type="number" min="2020" max="2100" required placeholder="2027" /></label>
      <label className="space-y-1 text-sm font-medium">Maximum backlogs<input className="input" name="maxBacklogs" type="number" min="0" defaultValue="0" required /></label>
      <label className="space-y-1 text-sm font-medium">Vacancies<input className="input" name="vacancies" type="number" min="1" required /></label>
      <label className="space-y-1 text-sm font-medium">Target semester (optional)<select className="input" name="targetSemester" defaultValue=""><option value="">Not specified</option>{[1,2,3,4,5,6,7,8].map((semester) => <option key={semester} value={semester}>{semester}</option>)}</select></label>
      <label className="space-y-1 text-sm font-medium">Publish date<input className="input" name="publishDate" type="date" required /></label>
      <label className="space-y-1 text-sm font-medium">Application deadline<input className="input" name="applicationDeadline" type="date" required /></label>
    </div>
    <label className="block space-y-1 text-sm font-medium">Job description<textarea className="input min-h-28" name="description" minLength="10" required /></label>
    <label className="block space-y-1 text-sm font-medium">Required skills (comma-separated)<input className="input" name="requiredSkills" placeholder="JavaScript, React, Node.js" /></label>
    <fieldset className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Eligible branches (select at least one)</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{['CSE','IT','ECE','EEE','ME','CE','Agriculture','Biotechnology','Chemical Engineering','Textile Engineering','Aerospace Engineering','Biomedical Engineering','Food Technology','Environmental Engineering','Petroleum Engineering','Civil Engineering','Electrical Engineering','Mechanical Engineering','Metallurgical Engineering','Instrumentation Engineering','Manufacturing Engineering'].map((branch) => <label key={branch} className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowedBranches" value={branch} />{branch}</label>)}</div></fieldset>
    <fieldset className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Allowed semesters (optional)</legend><div className="flex flex-wrap gap-4">{[1,2,3,4,5,6,7,8].map((semester) => <label key={semester} className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowedSemesters" value={semester} />{semester}</label>)}</div></fieldset>
    <div className="flex flex-wrap gap-2"><button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Submitting...' : 'Submit for approval'}</button><button className="btn-secondary" type="button" disabled={busy} onClick={() => setShowDriveForm(false)}>Cancel</button></div>
  </form>}
  {jobs.length ? <div className="grid gap-3 md:grid-cols-2">{jobs.map((job) => <div className="rounded-lg border p-4" key={job._id}><div className="flex justify-between"><strong>{job.title}</strong><Badge value={job.status} /></div><p className="mt-2 text-sm text-gray-500">{job.location} · {job.vacancies} vacancies</p><p className="mt-1 text-xs">Approval: {job.approvalStatus} · deadline {new Date(job.applicationDeadline).toLocaleDateString()}</p></div>)}</div> : <p className="text-gray-500">No drives created yet.</p>}
</div>}
'@
$replacementLines = $newDrives -split "`r?`n" | ForEach-Object { if ($_ -eq '') { '' } else { $indent + $_ } }
$lines.RemoveAt($driveIndexes[0])
$lines.InsertRange($driveIndexes[0], [string[]]$replacementLines)

# Save only after every expected anchor has been verified.
[System.IO.File]::WriteAllLines($target, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Host "Post Drive form and submit handler added successfully." -ForegroundColor Green
Write-Host "Only frontend/src/RecruiterDashboard.jsx was modified. No deployment was performed."
