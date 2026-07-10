function formatDateTime(date) {
  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

module.exports = { formatDateTime };
