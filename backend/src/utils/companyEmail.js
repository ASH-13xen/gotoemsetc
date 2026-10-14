// An employee's company mailbox — kept as the "COMPANY MAIL ID" row in their
// Extra Details (HR fills it in when the mailbox is set up). Null when there
// isn't one.
function companyEmailOf(employee) {
  const entry = (employee?.extraDetails || []).find((d) => d.key && d.key.trim().toUpperCase() === 'COMPANY MAIL ID');
  const value = entry?.value?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

module.exports = { companyEmailOf };
