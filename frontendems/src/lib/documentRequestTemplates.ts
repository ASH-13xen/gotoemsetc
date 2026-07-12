// Message templates for the "Request Documents" manual-send flow — kept
// separate from the generated-document send templates and any other
// message templates in the app, since each notification type has its own
// wording and its own set of variables (this one includes the access code,
// which nothing else does).

export function buildDocumentRequestEmailBody(
  employeeName: string,
  docLabels: string,
  link: string,
  accessCode: string,
  companyName: string
): string {
  return `Hi ${employeeName},\n\nPlease upload the following documents using the secure link below:\n${docLabels}\n\n${link}\n\nYou'll be asked for this access code before you can upload: ${accessCode}\n\nThanks,\n${companyName} HR`
}

export function buildDocumentRequestWhatsappText(
  employeeName: string,
  docLabels: string,
  link: string,
  accessCode: string
): string {
  return `Hi ${employeeName}, please upload the following documents using this secure link: ${docLabels}\n${link}\n\nAccess code: ${accessCode}`
}
