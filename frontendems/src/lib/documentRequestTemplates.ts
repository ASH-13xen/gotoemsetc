// Message template for the "Request Documents" manual WhatsApp-send flow —
// the email side of this notification is now sent automatically by the
// backend (see uploadRequest.service.js#sendUploadRequestEmail), kept
// separate from the generated-document send templates and any other message
// templates in the app since each notification type has its own wording and
// its own set of variables (this one includes the access code, which
// nothing else does).

export function buildDocumentRequestWhatsappText(
  employeeName: string,
  docLabels: string,
  link: string,
  accessCode: string
): string {
  return `Hi ${employeeName}, please upload the following documents using this secure link: ${docLabels}\n${link}\n\nAccess code: ${accessCode}`
}
