// What each Action centre item is called when it's acknowledged. One place,
// so the cards, the counts and the pop-up always agree.
export const ACTION_KEY = {
  salaryBatch: (id: string) => `salary:${id}`,
  salaryMail: (id: string) => `salary-mail:${id}`,
  heldSlip: (id: string) => `held:${id}`,
  fnfHr: (id: string) => `fnf-hr:${id}`,
  fnfApproval: (id: string) => `fnf-ok:${id}`,
  reimbursement: (id: string) => `reimb:${id}`,
  attendanceEdit: (id: string) => `att-edit:${id}`,
  leaveCm: (id: string) => `leave-cm:${id}`,
  leaveHr: (id: string) => `leave-hr:${id}`,
  leaveCeo: (id: string) => `leave-ceo:${id}`,
  overtimeCm: (id: string) => `ot-cm:${id}`,
  overtimeHr: (id: string) => `ot-hr:${id}`,
}

// Leave and overtime — what the pop-up shows.
export const POPS_UP = /^(leave-cm|leave-hr|leave-ceo|ot-cm|ot-hr):/
