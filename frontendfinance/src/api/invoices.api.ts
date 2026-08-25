import { apiClient } from './client'
import type { TransactionDetails } from './salarySlips.api'

export type InvoiceStatus = 'pending_approval' | 'approved' | 'sent' | 'paid'
export type PlanTier = 'gold' | 'platinum' | 'diamond'

export interface PlanPrice {
  _id: string
  plan: PlanTier
  amount: number
}

export interface InvoiceClientRef {
  _id: string
  name: string
  brandName?: string
}

export interface Invoice {
  _id: string
  client: InvoiceClientRef
  year: number
  month: number
  plan: PlanTier
  amount: number
  invoiceNumber: string
  status: InvoiceStatus
  sentAt?: string
  paidAt?: string
  transactionDetails?: TransactionDetails
}

export interface InvoiceFilter {
  status?: InvoiceStatus
  year?: number
  month?: number
  clientId?: string
  plan?: PlanTier
}

export interface InvoiceSummary {
  totalReceived: number
  totalDue: number
  byMonth: Array<{ year: number; month: number; received: number; due: number }>
  byClient: Array<{ clientId: string; clientName: string; received: number; due: number }>
}

export async function listPlanPrices(): Promise<{ prices: PlanPrice[] }> {
  const { data } = await apiClient.get('/invoices/plan-prices')
  return data
}

export async function setPlanPrices(prices: Array<{ plan: PlanTier; amount: number }>): Promise<{ prices: PlanPrice[] }> {
  const { data } = await apiClient.put('/invoices/plan-prices', { prices })
  return data
}

export async function listInvoices(filter: InvoiceFilter): Promise<{ invoices: Invoice[] }> {
  const { data } = await apiClient.get('/invoices', { params: filter })
  return data
}

export async function getInvoiceSummary(filter: InvoiceFilter): Promise<InvoiceSummary> {
  const { data } = await apiClient.get('/invoices/summary', { params: filter })
  return data
}

export async function generateInvoices(year?: number, month?: number): Promise<{ invoices: Invoice[] }> {
  const { data } = await apiClient.post('/invoices/generate', { year, month })
  return data
}

export async function approveInvoice(id: string): Promise<{ invoice: Invoice }> {
  const { data } = await apiClient.post(`/invoices/${id}/approve`)
  return data
}

export async function markInvoicePaid(id: string, input: TransactionDetails): Promise<{ invoice: Invoice }> {
  const { data } = await apiClient.post(`/invoices/${id}/mark-paid`, input)
  return data
}

export async function downloadInvoicePdfBlob(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
  return data
}
