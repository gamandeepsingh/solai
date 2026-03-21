import { getLocal, setLocal } from './storage'
import type { ScheduledJob } from '../types/agent'

export async function getScheduledJobs(): Promise<ScheduledJob[]> {
  return (await getLocal('scheduledJobs')) ?? []
}

export async function addScheduledJob(job: Omit<ScheduledJob, 'id' | 'createdAt'>): Promise<ScheduledJob> {
  const full: ScheduledJob = { ...job, id: crypto.randomUUID(), createdAt: Date.now() }
  const jobs = await getScheduledJobs()
  await setLocal('scheduledJobs', [...jobs, full])
  return full
}

export async function removeScheduledJob(id: string): Promise<void> {
  const jobs = await getScheduledJobs()
  await setLocal('scheduledJobs', jobs.filter(j => j.id !== id))
}

export async function updateJobNextRun(id: string, nextRun: number): Promise<void> {
  const jobs = await getScheduledJobs()
  await setLocal('scheduledJobs', jobs.map(j => j.id === id ? { ...j, nextRun } : j))
}

export function ensureSchedulerAlarm(): void {
  chrome.alarms.get('scheduler-tick', alarm => {
    if (!alarm) chrome.alarms.create('scheduler-tick', { periodInMinutes: 1 })
  })
}

export function ensurePriceAlarm(): void {
  chrome.alarms.get('price-check', alarm => {
    if (!alarm) chrome.alarms.create('price-check', { periodInMinutes: 5 })
  })
}
