function getByPath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function formatDate(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatCurrency(value) {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  if (Number.isNaN(num)) return undefined;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatAddress(address) {
  if (!address) return undefined;
  return [address.line1, address.line2, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join(', ');
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
}

function threeDigitWords(n) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return (hundred ? `${ONES[hundred]} Hundred${rest ? ' ' : ''}` : '') + (rest ? twoDigitWords(rest) : '');
}

// Indian numbering system (crore/lakh/thousand), used for the standard
// "Rupees X Only" phrasing on CTC figures.
function numberToIndianWords(num) {
  num = Math.round(Math.abs(Number(num) || 0));
  if (num === 0) return 'Zero';

  const crore = Math.floor(num / 1e7);
  num %= 1e7;
  const lakh = Math.floor(num / 1e5);
  num %= 1e5;
  const thousand = Math.floor(num / 1e3);
  num %= 1e3;
  const hundred = num;

  const parts = [];
  if (crore) parts.push(`${threeDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitWords(hundred));
  return parts.join(' ');
}

function formatCurrencyInWords(value) {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  if (Number.isNaN(num)) return undefined;
  return `Rupees ${numberToIndianWords(num)} Only`;
}

// Salary breakup is stored as monthly amounts on the employee; annual CTC and
// the monthly gross are always derived from it rather than entered separately,
// so the letter and the itemized table can never disagree with each other.
function computeSalaryTotals(employee) {
  const components = Array.isArray(employee.salaryComponents) ? employee.salaryComponents : [];
  const monthlyGross = components.reduce((sum, c) => sum + (Number(c.monthlyAmount) || 0), 0);
  return { monthlyGross, annualCTC: monthlyGross * 12 };
}

function resolveComputedField(key, employee) {
  switch (key) {
    case 'employeeName':
      return `${employee.firstName} ${employee.lastName || ''}`.trim();
    case 'employeeAddress':
      return formatAddress(employee.address);
    case 'todayDate':
      return formatDate(new Date());
    case 'annualCTC':
      return formatCurrency(computeSalaryTotals(employee).annualCTC);
    case 'annualCTCInWords':
      return formatCurrencyInWords(computeSalaryTotals(employee).annualCTC);
    case 'monthlyGross':
      return formatCurrency(computeSalaryTotals(employee).monthlyGross);
    default:
      return undefined;
  }
}

// Resolves a template's loops[] against the employee record — currently only
// `salaryComponents`, formatted per-item to match the loop's declared fields.
function buildLoopData(loops, employee) {
  const data = {};
  for (const loop of loops || []) {
    if (loop.key === 'salaryComponents') {
      const components = Array.isArray(employee.salaryComponents) ? employee.salaryComponents : [];
      data.salaryComponents = components.map((c) => ({
        label: c.label,
        monthlyAmount: formatCurrency(c.monthlyAmount),
        annualAmount: formatCurrency((Number(c.monthlyAmount) || 0) * 12),
      }));
    }
  }
  return data;
}

// Builds the flat {tagKey: value} object docxtemplater merges into a
// template, resolving each declared field from the employee record, a
// small set of computed helpers, or admin-supplied per-generation overrides.
function buildMergeData(template, employee, overrides = {}) {
  const plainEmployee = typeof employee.toObject === 'function' ? employee.toObject() : employee;
  const data = {};

  for (const field of template.fields) {
    let value;

    if (field.source === 'manual') {
      value = overrides[field.key];
    } else if (field.source === 'computed') {
      // Computed resolvers already return display-ready strings (todayDate
      // is pre-formatted), so they skip the generic type-based formatting
      // below to avoid re-parsing an already-formatted string.
      value = resolveComputedField(field.key, plainEmployee);
    } else {
      value = getByPath(plainEmployee, field.mapsTo || field.key);
    }

    if (field.source !== 'computed') {
      if (field.type === 'date') value = formatDate(value);
      if (field.type === 'currency') value = formatCurrency(value);
      if (field.type === 'select' && typeof value === 'string') {
        value = value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }

    if (value !== undefined && value !== null && value !== '') {
      data[field.key] = value;
    } else if (!field.required) {
      // Optional field left blank: render as empty rather than leaving the
      // key absent, which would otherwise trip docxtemplater's nullGetter —
      // that check has no concept of "optional", it flags any missing tag.
      data[field.key] = '';
    }
    // Required field left blank: key stays absent, so nullGetter correctly
    // reports it as missing (see docxRender.service's precise error message).
  }

  Object.assign(data, buildLoopData(template.loops, plainEmployee));

  return data;
}

module.exports = { buildMergeData, numberToIndianWords };
