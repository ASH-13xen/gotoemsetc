// Message templates for the client "Request Documents" manual-send flow —
// kept separate from any other message templates, same convention as
// frontendems's lib/documentRequestTemplates.ts.

export function buildDocumentRequestEmailBody(
  clientName: string,
  docLabels: string,
  link: string,
  accessCode: string
): string {
  return `Hi ${clientName},\n\nPlease upload the following documents using the secure link below:\n${docLabels}\n\n${link}\n\nYou'll be asked for this access code before you can upload: ${accessCode}\n\nThanks,\nGO-TO Friend`
}

export function buildDocumentRequestWhatsappText(
  clientName: string,
  docLabels: string,
  link: string,
  accessCode: string
): string {
  return `Hi ${clientName}, please upload the following documents using this secure link: ${docLabels}\n${link}\n\nAccess code: ${accessCode}`
}
