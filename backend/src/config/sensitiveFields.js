// Field names considered sensitive/money-related per resource. Nothing is
// hidden from any role yet — see utils/fieldGate.js — this is the registry
// that gets consulted once real per-role redaction rules are specified.
module.exports = {
  Employee: [
    'ctcAnnual',
    'monthlyPay',
    'salaryComponents',
    'bankAccountNumber',
    'bankIFSC',
    'panNumber',
    'aadharNumber',
  ],
  Quotation: [],
};
