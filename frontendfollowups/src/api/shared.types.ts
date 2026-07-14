// Generic employee reference shape, shared by tasks.api.ts and teams.api.ts
// (assignees, team members/leader) — split out on its own since neither is
// conceptually about meetings, which used to be this type's only source.
export interface EmployeeRef {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
  employeeCode?: string
}
