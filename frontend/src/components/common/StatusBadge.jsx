function StatusBadge({ status }) {
  const value = status || 'unknown';
  const styles = {
    active: 'badge-green',
    approved: 'badge-green',
    placed: 'badge-green',
    selected: 'badge-green',
    accepted: 'badge-green',
    issued: 'badge-blue',
    pending: 'badge-yellow',
    generated: 'badge-yellow',
    interview: 'badge-yellow',
    shortlisted: 'badge-blue',
    rejected: 'badge-red',
    expired: 'badge-red',
    revoked: 'badge-red',
    closed: 'badge-red',
    inactive: 'badge-red',
    cancelled: 'badge-red',
    withdrawn: 'badge-gray',
    'opted-out': 'badge-gray',
    'higher-studies': 'badge-blue',
  };
  return <span className={styles[value] || 'badge-gray'}>{value}</span>;
}

export default StatusBadge;
