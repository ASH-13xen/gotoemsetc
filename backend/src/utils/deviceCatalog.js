// The fixed vocabulary of HR Work → Devices (services/device.service.js):
// what a device check looks at, the security settings that must be on, the
// apps a company phone carries by default, and how issues are filed. One
// place, so the HR screens, the employee's self-check and the server agree.

const DEVICE_KIND = { PHONE: 'phone', LAPTOP: 'laptop', TABLET: 'tablet', OTHER: 'other' };
const DEVICE_KIND_PREFIX = { phone: 'PH', laptop: 'LT', tablet: 'TB', other: 'OT' };
const DEVICE_OS = ['android', 'ios', 'windows', 'macos', 'other'];

const DEVICE_STATUS = { AVAILABLE: 'available', ASSIGNED: 'assigned', REPAIR: 'repair', LOST: 'lost', RETIRED: 'retired' };
const ASSIGNMENT_STATUS = { ACTIVE: 'active', RETURNED: 'returned', LOST: 'lost' };
const CHECK_KIND = { HANDOVER: 'handover', RETURN: 'return', MONTHLY: 'monthly', ADHOC: 'adhoc' };
const CHECK_STATUS = { SUBMITTED: 'submitted', VERIFIED: 'verified', REJECTED: 'rejected' };

// Overall condition, best first.
const GRADES = ['A', 'B', 'C', 'D'];
const GRADE_LABEL = { A: 'Like new', B: 'Minor wear', C: 'Visible damage', D: 'Needs repair' };

// Each part is rated ok / worn / damaged (a guard or cover can also be missing).
const PART_STATES = ['ok', 'worn', 'damaged', 'missing'];

// iPhone: Settings → General → About → "Parts and Service History" lists a
// replaced part as "Genuine Apple Part" or "Unknown Part"; a part never
// replaced is not listed at all.
const GENUINE_PARTS = [
  { key: 'display', label: 'Display' },
  { key: 'battery', label: 'Battery' },
  { key: 'camera', label: 'Camera' },
];
const GENUINE_STATES = ['not_listed', 'genuine', 'unknown'];
const PARTS = {
  phone: [
    { key: 'screen', label: 'Screen' },
    { key: 'backGlass', label: 'Back glass / body' },
    { key: 'frame', label: 'Frame & buttons' },
    { key: 'frontCamera', label: 'Front camera' },
    { key: 'backCamera', label: 'Back camera' },
    { key: 'speakerMic', label: 'Speaker & mic' },
    { key: 'chargingPort', label: 'Charging port' },
    { key: 'screenGuard', label: 'Screen guard' },
    { key: 'backCover', label: 'Back cover' },
  ],
  laptop: [
    { key: 'screen', label: 'Screen' },
    { key: 'body', label: 'Body & hinges' },
    { key: 'keyboard', label: 'Keyboard & trackpad' },
    { key: 'ports', label: 'Ports' },
    { key: 'webcam', label: 'Webcam' },
    { key: 'speakerMic', label: 'Speaker & mic' },
  ],
};
PARTS.tablet = PARTS.phone;
PARTS.other = [{ key: 'body', label: 'Body' }];

// The settings that make a lost device recoverable and its accounts safe.
const SECURITY_ITEMS = [
  { key: 'screenLock', label: 'Screen lock on (PIN plus fingerprint or face)', kinds: ['phone', 'tablet', 'laptop'] },
  { key: 'findMy', label: 'Find My Device / Find My iPhone on, signed in to the company account', kinds: ['phone', 'tablet', 'laptop'] },
  { key: 'theftProtection', label: 'Theft protection on (Android Theft Protection / iPhone Stolen Device Protection)', kinds: ['phone', 'tablet'] },
  { key: 'accountTwoFactor', label: '2-step verification on the company Google / Apple account, codes to a company number', kinds: ['phone', 'tablet', 'laptop'] },
  { key: 'whatsappTwoStep', label: 'WhatsApp two-step verification PIN set', kinds: ['phone'] },
  { key: 'companyMail', label: "The holder's company mail added", kinds: ['phone', 'tablet', 'laptop'] },
  { key: 'contactsSync', label: 'Contacts syncing with the company Gmail (on iPhone: Gmail is the default contacts account)', kinds: ['phone'] },
  { key: 'photosBackup', label: 'Google Photos backing up to the company account', kinds: ['phone', 'tablet'] },
];
const securityItemsFor = (kind) => SECURITY_ITEMS.filter((s) => s.kinds.includes(kind));

// What a company phone carries unless HR changes the list (Settings).
const DEFAULT_APPS = [
  { key: 'whatsapp_business', label: 'WhatsApp Business', required: true },
  { key: 'instagram', label: 'Instagram', required: true },
  { key: 'facebook', label: 'Facebook', required: true },
  { key: 'linkedin', label: 'LinkedIn', required: true },
  { key: 'youtube', label: 'YouTube', required: true },
  { key: 'google_business', label: 'Google Business Profile', required: true },
  { key: 'google_photos', label: 'Google Photos', required: true },
  { key: 'google_drive', label: 'Google Drive', required: true },
  { key: 'gmail', label: 'Gmail', required: true },
  { key: 'truecaller', label: 'Truecaller', required: true },
];

const ISSUE_CATEGORIES = {
  storage: 'Storage full',
  app_install: "An app won't install",
  apple_id: 'Apple ID not syncing',
  google_account: 'Google account / contacts not syncing',
  battery: 'Battery',
  damage: 'Damage',
  network_sim: 'Network / SIM',
  slow: 'Slow / freezing',
  other: 'Something else',
};

const ACCOUNT_KINDS = {
  apple_id: 'Apple ID',
  google: 'Google account (Gmail)',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  google_business: 'Google Business Profile',
  truecaller: 'Truecaller',
  other: 'Other',
};

// The access matrix: which device an access item belongs to.
const ACCESS_DEVICE_TYPES = {
  company_phone: 'Company phone',
  personal_phone: 'Personal phone',
  office_laptop: 'Office laptop',
  personal_laptop: 'Personal laptop',
};
const ACCESS_ITEM_KINDS = { app: 'App / login', account: 'Account', group: 'Group', other: 'Other' };

const ACCESSORY_KINDS = { charger: 'Charger', cable: 'Cable', cover: 'Back cover', guard: 'Screen guard', earphones: 'Earphones', mouse: 'Mouse', other: 'Other' };

// The steps a lost device's runbook walks through, in order.
const LOST_STEPS = [
  { key: 'lock', label: 'Lock the device', detail: 'Find My Device (android.com/find) or Find My (icloud.com/find): mark as lost / secure the device, with a message and a company number on the lock screen.' },
  { key: 'locate', label: 'Try to locate it', detail: 'Note the last location shown, and when it was seen.' },
  { key: 'sim', label: 'Block the SIM', detail: "Call the carrier with the number and ask for a block; ask for a replacement SIM on the same number." },
  { key: 'passwords', label: 'Change the passwords of every account on it', detail: 'Each account listed below — and sign the lost device out (Google: Security → Your devices; Apple ID: Devices; WhatsApp: Linked devices).' },
  { key: 'police', label: 'File a police complaint with the IMEI', detail: "Upload the complaint copy here. With the IMEI, the government CEIR portal can block the phone on every network." },
  { key: 'erase', label: 'Erase it if it is not found', detail: 'Find My Device / Find My: erase. Only once it is clearly not coming back — after erasing it can no longer be located.' },
  { key: 'recovery', label: 'Settle the recovery', detail: "Its recovery value goes on the holder's full & final if they have left, or is decided with them." },
];

module.exports = {
  DEVICE_KIND,
  DEVICE_KIND_PREFIX,
  DEVICE_OS,
  DEVICE_STATUS,
  ASSIGNMENT_STATUS,
  CHECK_KIND,
  CHECK_STATUS,
  GRADES,
  GRADE_LABEL,
  PART_STATES,
  PARTS,
  GENUINE_PARTS,
  GENUINE_STATES,
  SECURITY_ITEMS,
  securityItemsFor,
  DEFAULT_APPS,
  ISSUE_CATEGORIES,
  ACCOUNT_KINDS,
  ACCESS_DEVICE_TYPES,
  ACCESS_ITEM_KINDS,
  ACCESSORY_KINDS,
  LOST_STEPS,
};
