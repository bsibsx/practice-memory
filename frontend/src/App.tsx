import { useEffect, useMemo, useState } from 'react'
import './App.css'

import {
  addPhoneNumber,
  createPatient,
  deactivatePhoneNumber,
  getPatients,
  setPrimaryPhoneNumber,
  updatePatient,
  type Patient,
} from './api/patients'

import {
  getPatientActivity,
  getRemovedPatientActivity,
  removePatientActivity,
  restorePatientActivity,
  type ActivityType,
  type PatientActivity,
} from './api/activity'

import {
  addEmailAddress,
  deactivateEmailAddress,
  getPatientEmailAddresses,
  getPrimaryEmailAddress,
  setPrimaryEmailAddress,
  type EmailAddress,
} from './api/emailAddresses'

import {
  assignEmailPatient,
  dismissEmail,
  getEmails,
  restoreEmail,
  sendPatientEmails,
  updateEmailStaffNote,
  updateEmailStatus,
  type EmailAttentionStatus,
  type EmailResponse,
} from './api/emails'

import {
  createPatientNote,
  updatePatientNote,
} from './api/notes'

import {
  assignCallPatient,
  dismissCall,
  getCalls,
  restoreCall,
  updateCallFollowUp,
  updateCallNote,
  type CallFollowUpStatus,
  type CallResponse,
} from './api/calls'

import {
  getInbox,
  type InboxItem,
} from './api/inbox'

type AppView =
    | 'PATIENTS'
    | 'INBOX'
    | 'HISTORY'

type InboxTab =
    | 'ATTENTION'
    | 'UNMATCHED'
    | 'DISMISSED'
    | 'RESOLVED'
    | 'ALL'

type CommunicationHistoryItem = {
  type: ActivityType
  direction: 'INBOUND' | 'OUTBOUND' | null
  id: number
  occurredAt: string
  title: string
  contact: string | null
  patientId: number | null
  patientName: string
  preview: string | null
  status: string | null
  callStatus: string | null
  secondaryStatus: string | null
  matchStatus: string
  triageStatus: string
  resolved: boolean
  dismissed: boolean
  needsAttention: boolean
  unmatched: boolean
}

type HistoryDateMode =
    | 'TODAY'
    | 'YESTERDAY'
    | 'CUSTOM'
    | 'ALL_TIME'

type HistoryCallOutcome =
    | 'COMPLETED'
    | 'MISSED'
    | 'NO_ANSWER'
    | 'ANSWERED'

type HistoryWorkflow =
    | 'NEEDS_ATTENTION'
    | 'RESOLVED'
    | 'DISMISSED'
    | 'UNMATCHED'

type HistoryNote = {
  activity: PatientActivity
  patientId: number
  patientName: string
}

const HISTORY_PAGE_SIZE = 10

type PendingPatientAssignment = {
  type: 'CALL' | 'EMAIL'
  id: number
  label: string
  contact: string
  canReuseSource: boolean
} | null

type PendingDismissal = {
  type: 'CALL' | 'EMAIL'
  id: number
  label: string
  contact: string
  canReuseSource: boolean
} | null

type ComposerMode =
    | 'EMAIL'
    | 'NOTE'
    | 'CALL_NOTE'
    | 'EMAIL_NOTE'
    | null

type ActivityFilter =
    | 'ALL'
    | 'CALL'
    | 'EMAIL'
    | 'NOTE'
    | 'REMOVED'

type PendingActivityAction = {
  action: 'REMOVE' | 'RESTORE'
  activity: PatientActivity
} | null

function getInitials(
    patient: Patient,
) {
  return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`
      .toUpperCase()
}

function formatDateOfBirth(
    dateOfBirth: string | null,
) {
  if (!dateOfBirth) {
    return 'Not recorded'
  }

  const [year, month, day] =
      dateOfBirth.split('-')

  if (!year || !month || !day) {
    return dateOfBirth
  }

  return `${day}/${month}/${year}`
}

function parseDateOfBirthInput(
    value: string,
): string | null | undefined {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  let year: number
  let month: number
  let day: number

  const dayFirstMatch = trimmed.match(
      /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/,
  )

  const compactMatch = trimmed.match(
      /^(\d{2})(\d{2})(\d{4})$/,
  )

  const isoMatch = trimmed.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  )

  if (dayFirstMatch) {
    day = Number(dayFirstMatch[1])
    month = Number(dayFirstMatch[2])
    year = Number(dayFirstMatch[3])
  } else if (compactMatch) {
    day = Number(compactMatch[1])
    month = Number(compactMatch[2])
    year = Number(compactMatch[3])
  } else if (isoMatch) {
    year = Number(isoMatch[1])
    month = Number(isoMatch[2])
    day = Number(isoMatch[3])
  } else {
    return undefined
  }

  const candidate = new Date(
      Date.UTC(year, month - 1, day),
  )

  if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() + 1 !== month ||
      candidate.getUTCDate() !== day
  ) {
    return undefined
  }

  const today = new Date()
  const todayUtc = new Date(
      Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
      ),
  )

  if (candidate > todayUtc) {
    return undefined
  }

  return `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day
      .toString()
      .padStart(2, '0')}`
}

function activityIcon(
    type: PatientActivity['type'],
) {
  if (type === 'CALL') return '☎'
  if (type === 'EMAIL') return '✉'
  return '📝'
}

function getActivityTitle(
    activity: PatientActivity,
) {
  if (activity.type === 'NOTE') {
    return 'Note'
  }

  if (activity.type === 'EMAIL') {
    if (activity.emailSubject) {
      return activity.emailSubject
    }

    return activity.emailDirection === 'OUTBOUND'
        ? 'Sent email'
        : 'Received email'
  }

  const outbound =
      activity.callDirection === 'OUTBOUND'

  if (activity.callStatus === 'MISSED') {
    return outbound
        ? 'Outgoing call · missed'
        : 'Missed call'
  }

  if (activity.callStatus === 'NO_ANSWER') {
    return outbound
        ? 'Outgoing call · no answer'
        : 'Call · no answer'
  }

  if (activity.callStatus === 'COMPLETED') {
    return outbound
        ? 'Outgoing call'
        : 'Incoming call'
  }

  if (activity.callStatus === 'ANSWERED') {
    return outbound
        ? 'Outgoing call · answered'
        : 'Answered call'
  }

  if (activity.callStatus === 'FAILED') {
    return outbound
        ? 'Failed outgoing call'
        : 'Failed incoming call'
  }

  if (activity.callStatus === 'RINGING') {
    return outbound
        ? 'Outgoing call'
        : 'Incoming call'
  }

  return outbound
      ? 'Outgoing call'
      : 'Incoming call'
}

function getCallResponseTitle(
    call: CallResponse,
) {
  const outbound = call.direction === 'OUTBOUND'

  if (call.callStatus === 'MISSED') {
    return outbound ? 'Outgoing call · missed' : 'Missed call'
  }

  if (call.callStatus === 'NO_ANSWER') {
    return outbound ? 'Outgoing call · no answer' : 'Call · no answer'
  }

  if (call.callStatus === 'FAILED') {
    return outbound ? 'Failed outgoing call' : 'Failed incoming call'
  }

  return outbound ? 'Outgoing call' : 'Incoming call'
}

function getActivityStatus(
    activity: PatientActivity,
) {
  if (activity.type === 'EMAIL') {
    return activity.emailStatus
  }

  if (activity.type === 'CALL') {
    return activity.callStatus
  }

  return null
}

function formatStatus(
    status: string,
) {
  return status
      .toLowerCase()
      .replaceAll('_', ' ')
}

function getStatusBadgeStyle(
    status: string,
) {
  if (
      status === 'MISSED' ||
      status === 'NO_ANSWER' ||
      status === 'FAILED' ||
      status === 'UNREAD' ||
      status === 'FOLLOW_UP_REQUIRED'
  ) {
    return {
      background: '#fff0f0',
      color: '#a53d3d',
      border: '1px solid #f2caca',
    }
  }

  if (status === 'AWAITING_REPLY') {
    return {
      background: '#fff7e6',
      color: '#98661a',
      border: '1px solid #f0d9a8',
    }
  }

  if (
      status === 'RESOLVED' ||
      status === 'SENT' ||
      status === 'COMPLETED' ||
      status === 'ANSWERED'
  ) {
    return {
      background: '#edf8f0',
      color: '#39734a',
      border: '1px solid #cce6d3',
    }
  }

  if (status === 'RINGING') {
    return {
      background: '#eef5ff',
      color: '#3567a8',
      border: '1px solid #cdddf4',
    }
  }

  return {
    background: '#f3f5f6',
    color: '#667680',
    border: '1px solid #dde2e5',
  }
}

function getFollowUpBadgeStyle(
    status: string,
) {
  if (status === 'FOLLOW_UP_REQUIRED') {
    return {
      background: '#fff0f0',
      color: '#a53d3d',
      border: '1px solid #f2caca',
    }
  }

  if (status === 'RESOLVED') {
    return {
      background: '#edf8f0',
      color: '#39734a',
      border: '1px solid #cce6d3',
    }
  }

  return {
    background: '#f3f5f6',
    color: '#667680',
    border: '1px solid #dde2e5',
  }
}

function formatActivityTime(
    dateString: string,
) {
  return new Intl.DateTimeFormat(
      undefined,
      {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      },
  ).format(
      new Date(dateString),
  )
}

function formatCallDuration(
    durationSeconds: number | null,
) {
  if (durationSeconds === null) {
    return null
  }

  const minutes =
      Math.floor(durationSeconds / 60)

  const seconds =
      durationSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds}s`
}

function getFilterLabel(
    filter: ActivityFilter,
) {
  switch (filter) {
    case 'ALL':
      return 'All'

    case 'CALL':
      return 'Calls'

    case 'EMAIL':
      return 'Emails'

    case 'NOTE':
      return 'Notes'

    case 'REMOVED':
      return 'Removed'
  }
}

function getActivityKey(
    activity: PatientActivity,
) {
  return `${activity.type}-${activity.id}`
}

function toLocalDateValue(
    value: Date,
) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function localDateForInstant(
    instant: string,
) {
  return toLocalDateValue(new Date(instant))
}

function shiftDateValue(
    dateValue: string,
    days: number,
) {
  const [year, month, day] = dateValue
      .split('-')
      .map(Number)

  const date = new Date(
      year,
      month - 1,
      day,
  )

  date.setDate(date.getDate() + days)

  return toLocalDateValue(date)
}

function formatHistoryDate(
    dateValue: string,
) {
  const [year, month, day] = dateValue
      .split('-')
      .map(Number)

  return new Intl.DateTimeFormat(
      undefined,
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
  ).format(
      new Date(year, month - 1, day),
  )
}

function App() {
  const [
    appView,
    setAppView,
  ] = useState<AppView>('PATIENTS')

  const [
    inboxItems,
    setInboxItems,
  ] = useState<InboxItem[]>([])

  const [
    loadingInbox,
    setLoadingInbox,
  ] = useState(false)

  const [
    inboxError,
    setInboxError,
  ] = useState<string | null>(null)

  const [
    inboxTab,
    setInboxTab,
  ] = useState<InboxTab>('ATTENTION')

  const [
    historyFromDate,
    setHistoryFromDate,
  ] = useState(() =>
      toLocalDateValue(new Date()),
  )

  const [
    historyToDate,
    setHistoryToDate,
  ] = useState(() =>
      toLocalDateValue(new Date()),
  )

  const [
    historyPage,
    setHistoryPage,
  ] = useState(1)

  const [historyDateMode, setHistoryDateMode] =
      useState<HistoryDateMode>('TODAY')

  const [historyTypes, setHistoryTypes] =
      useState<ActivityType[]>(['CALL', 'EMAIL', 'NOTE'])

  const [historyCallOutcomes, setHistoryCallOutcomes] =
      useState<HistoryCallOutcome[]>([])

  const [historyWorkflows, setHistoryWorkflows] =
      useState<HistoryWorkflow[]>([])

  const [historyFiltersExpanded, setHistoryFiltersExpanded] =
      useState(false)

  const [historyNotes, setHistoryNotes] =
      useState<HistoryNote[]>([])

  const [loadingHistory, setLoadingHistory] =
      useState(false)

  const [historyError, setHistoryError] =
      useState<string | null>(null)

  const [
    unmatchedCalls,
    setUnmatchedCalls,
  ] = useState<CallResponse[]>([])

  const [
    unmatchedEmails,
    setUnmatchedEmails,
  ] = useState<EmailResponse[]>([])

  const [
    loadingUnmatched,
    setLoadingUnmatched,
  ] = useState(false)

  const [
    unmatchedError,
    setUnmatchedError,
  ] = useState<string | null>(null)

  const [
    pendingPatientAssignment,
    setPendingPatientAssignment,
  ] = useState<PendingPatientAssignment>(null)

  const [
    assignmentSearch,
    setAssignmentSearch,
  ] = useState('')

  const [
    assignmentPatientId,
    setAssignmentPatientId,
  ] = useState<number | null>(null)

  const [
    assignmentRunning,
    setAssignmentRunning,
  ] = useState(false)

  const [
    assignmentError,
    setAssignmentError,
  ] = useState<string | null>(null)

  const [
    assignSameSource,
    setAssignSameSource,
  ] = useState(true)

  const [
    saveSourceAsContact,
    setSaveSourceAsContact,
  ] = useState(false)

  const [
    pendingDismissal,
    setPendingDismissal,
  ] = useState<PendingDismissal>(null)

  const [
    treatFutureAsSpam,
    setTreatFutureAsSpam,
  ] = useState(false)

  const [
    dismissalRunning,
    setDismissalRunning,
  ] = useState(false)

  const [
    dismissalError,
    setDismissalError,
  ] = useState<string | null>(null)

  const [
    patients,
    setPatients,
  ] = useState<Patient[]>([])

  const [
    selectedPatientId,
    setSelectedPatientId,
  ] = useState<number | null>(null)

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    loadingPatients,
    setLoadingPatients,
  ] = useState(true)

  const [
    patientError,
    setPatientError,
  ] = useState<string | null>(null)

  const [
    activities,
    setActivities,
  ] = useState<PatientActivity[]>([])

  const [
    loadingActivity,
    setLoadingActivity,
  ] = useState(false)

  const [
    activityError,
    setActivityError,
  ] = useState<string | null>(null)

  const [
    activityFilter,
    setActivityFilter,
  ] = useState<ActivityFilter>('ALL')

  const [
    openActivityMenuKey,
    setOpenActivityMenuKey,
  ] = useState<string | null>(null)

  const [
    pendingActivityAction,
    setPendingActivityAction,
  ] = useState<PendingActivityAction>(
      null,
  )

  const [
    activityActionRunning,
    setActivityActionRunning,
  ] = useState(false)

  const [
    activityActionError,
    setActivityActionError,
  ] = useState<string | null>(null)

  const [
    emailAddresses,
    setEmailAddresses,
  ] = useState<EmailAddress[]>([])

  const [
    loadingEmailAddresses,
    setLoadingEmailAddresses,
  ] = useState(false)

  const [
    emailAddressError,
    setEmailAddressError,
  ] = useState<string | null>(null)

  const [
    composerMode,
    setComposerMode,
  ] = useState<ComposerMode>(null)

  const [
    editingNoteId,
    setEditingNoteId,
  ] = useState<number | null>(null)

  const [
    editingCallId,
    setEditingCallId,
  ] = useState<number | null>(null)

  const [
    editingEmailId,
    setEditingEmailId,
  ] = useState<number | null>(null)

  const [
    emailSubject,
    setEmailSubject,
  ] = useState('')

  const [
    selectedEmailAddressId,
    setSelectedEmailAddressId,
  ] = useState<number | null>(null)

  const [
    replyToEmailId,
    setReplyToEmailId,
  ] = useState<number | null>(null)

  const [
    sendToAllEmails,
    setSendToAllEmails,
  ] = useState(false)

  const [
    composerText,
    setComposerText,
  ] = useState('')

  const [
    sendingEmail,
    setSendingEmail,
  ] = useState(false)

  const [
    emailSent,
    setEmailSent,
  ] = useState(false)

  const [
    updatingEmailStatusId,
    setUpdatingEmailStatusId,
  ] = useState<number | null>(null)

  const [
    updatingCallFollowUpId,
    setUpdatingCallFollowUpId,
  ] = useState<number | null>(null)

  const [
    savingNote,
    setSavingNote,
  ] = useState(false)

  const [
    noteSaved,
    setNoteSaved,
  ] = useState(false)

  const [
    composerError,
    setComposerError,
  ] = useState<string | null>(null)

  const [
    editingPatient,
    setEditingPatient,
  ] = useState(false)

  const [
    editFirstName,
    setEditFirstName,
  ] = useState('')

  const [
    editLastName,
    setEditLastName,
  ] = useState('')

  const [
    editDateOfBirth,
    setEditDateOfBirth,
  ] = useState('')

  const [
    savingPatient,
    setSavingPatient,
  ] = useState(false)

  const [
    patientEditError,
    setPatientEditError,
  ] = useState<string | null>(null)

  const [
    patientSaveConfirmation,
    setPatientSaveConfirmation,
  ] = useState<string | null>(null)

  const [
    newPhoneNumber,
    setNewPhoneNumber,
  ] = useState('')

  const [
    managingPhone,
    setManagingPhone,
  ] = useState(false)

  const [
    pendingPhoneRemovalIds,
    setPendingPhoneRemovalIds,
  ] = useState<number[]>([])

  const [
    newEmailAddress,
    setNewEmailAddress,
  ] = useState('')

  const [
    managingEmail,
    setManagingEmail,
  ] = useState(false)

  const [
    pendingEmailRemovalIds,
    setPendingEmailRemovalIds,
  ] = useState<number[]>([])

  const [
    creatingPatient,
    setCreatingPatient,
  ] = useState(false)

  const [
    createFirstName,
    setCreateFirstName,
  ] = useState('')

  const [
    createLastName,
    setCreateLastName,
  ] = useState('')

  const [
    createDateOfBirth,
    setCreateDateOfBirth,
  ] = useState('')

  const [
    createPhoneNumber,
    setCreatePhoneNumber,
  ] = useState('')

  const [
    createEmailAddress,
    setCreateEmailAddress,
  ] = useState('')

  const [
    creatingPatientRequest,
    setCreatingPatientRequest,
  ] = useState(false)

  const [
    createPatientError,
    setCreatePatientError,
  ] = useState<string | null>(null)

  /* =========================================
     LOAD PATIENTS
     ========================================= */

  useEffect(() => {
    async function loadPatients() {
      try {
        const loadedPatients =
            await getPatients()

        setPatients(
            loadedPatients,
        )

        if (
            loadedPatients.length >
            0
        ) {
          setSelectedPatientId(
              loadedPatients[0].id,
          )
        }
      } catch (error) {
        console.error(error)

        setPatientError(
            'Could not load patients.',
        )
      } finally {
        setLoadingPatients(
            false,
        )
      }
    }

    void loadPatients()
  }, [])

  /* =========================================
     LOAD INBOX
     ========================================= */

  useEffect(() => {
    void refreshInbox()
    void refreshUnmatched()
  }, [])

  /* =========================================
     LOAD ACTIVITY
     ========================================= */

  useEffect(() => {
    if (
        selectedPatientId === null
    ) {
      setActivities([])
      return
    }

    let cancelled = false

    async function loadActivity() {
      setLoadingActivity(true)
      setActivityError(null)
      setActivityActionError(null)
      setOpenActivityMenuKey(null)

      try {
        const loadedActivity =
            activityFilter ===
            'REMOVED'
                ? await getRemovedPatientActivity(
                    selectedPatientId!,
                )
                : await getPatientActivity(
                    selectedPatientId!,
                )

        if (!cancelled) {
          setActivities(
              loadedActivity,
          )
        }
      } catch (error) {
        console.error(error)

        if (!cancelled) {
          setActivityError(
              activityFilter ===
              'REMOVED'
                  ? 'Could not load removed activity.'
                  : 'Could not load patient activity.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingActivity(
              false,
          )
        }
      }
    }

    void loadActivity()

    return () => {
      cancelled = true
    }
  }, [
    selectedPatientId,
    activityFilter,
  ])

  /* =========================================
     LOAD EMAIL ADDRESSES
     ========================================= */

  useEffect(() => {
    if (
        selectedPatientId === null
    ) {
      setEmailAddresses([])
      return
    }

    let cancelled = false

    async function loadEmailAddresses() {
      setLoadingEmailAddresses(
          true,
      )
      setEmailAddressError(null)
      setEmailAddresses([])

      try {
        const loadedAddresses =
            await getPatientEmailAddresses(
                selectedPatientId!,
            )

        if (!cancelled) {
          setEmailAddresses(
              loadedAddresses,
          )
        }
      } catch (error) {
        console.error(error)

        if (!cancelled) {
          setEmailAddressError(
              'Could not load email address.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingEmailAddresses(
              false,
          )
        }
      }
    }

    void loadEmailAddresses()

    return () => {
      cancelled = true
    }
  }, [selectedPatientId])

  /* =========================================
     SEARCH
     ========================================= */

  const filteredPatients =
      useMemo(() => {
        const query =
            search
                .trim()
                .toLowerCase()

        if (!query) {
          return patients
        }

        return patients.filter(
            (patient) => {
              const fullName =
                  `${patient.firstName} ${patient.lastName}`
                      .toLowerCase()

              const dateOfBirth =
                  patient.dateOfBirth ?? ''

              const formattedDateOfBirth =
                  formatDateOfBirth(
                      patient.dateOfBirth,
                  ).toLowerCase()

              const patientNumber =
                  String(patient.id)

              const phoneMatch =
                  patient.phoneNumbers.some(
                      (phoneNumber) =>
                          phoneNumber.active &&
                          phoneNumber.number
                              .toLowerCase()
                              .includes(query),
                  )

              const emailMatch =
                  (patient.emailAddresses ?? []).some(
                      (emailAddress) =>
                          emailAddress.active &&
                          emailAddress.address
                              .toLowerCase()
                              .includes(query),
                  )

              return (
                fullName.includes(query) ||
                dateOfBirth.includes(query) ||
                formattedDateOfBirth.includes(query) ||
                patientNumber === query ||
                `patient ${patientNumber}`.includes(query) ||
                `patient #${patientNumber}`.includes(query) ||
                phoneMatch ||
                emailMatch
              )
            },
        )
      }, [
        patients,
        search,
      ])

  const unmatchedCommunications =
      useMemo(() => {
        const callItems =
            unmatchedCalls
                .filter(
                    (call) =>
                        call.patientMatchStatus !==
                        'MATCHED' &&
                        call.triageStatus ===
                        'ACTIVE',
                )
                .map(
                    (call) => ({
                      type: 'CALL' as const,
                      id: call.id,
                      occurredAt:
                          call.startedAt,
                      matchStatus:
                          call.patientMatchStatus,
                      title:
                          getCallResponseTitle(
                              call,
                          ),
                      contact:
                          call.counterpartyNumber ??
                          'Private / withheld number',
                      canReuseSource:
                          call.counterpartyNumber !== null,
                      preview:
                          call.note,
                    }),
                )

        const emailItems =
            unmatchedEmails
                .filter(
                    (email) =>
                        email.patientMatchStatus !==
                        'MATCHED' &&
                        email.triageStatus ===
                        'ACTIVE',
                )
                .map(
                    (email) => ({
                      type: 'EMAIL' as const,
                      id: email.id,
                      occurredAt:
                          email.sentAt,
                      matchStatus:
                          email.patientMatchStatus,
                      title:
                          email.subject ||
                          'Received email',
                      contact:
                          email.fromAddress,
                      canReuseSource: true,
                      preview:
                          email.bodyText,
                    }),
                )

        return [
          ...callItems,
          ...emailItems,
        ].sort(
            (left, right) =>
                new Date(
                    right.occurredAt,
                ).getTime() -
                new Date(
                    left.occurredAt,
                ).getTime(),
        )
      }, [
        unmatchedCalls,
        unmatchedEmails,
      ])

  const communicationHistory =
      useMemo<CommunicationHistoryItem[]>(() => {
        const callItems =
            unmatchedCalls.map(
                (call) => ({
                  type: 'CALL' as const,
                  direction: call.direction,
                  id: call.id,
                  occurredAt: call.startedAt,
                  title: getCallResponseTitle(call),
                  contact:
                      call.counterpartyNumber ??
                      'Private / withheld number',
                  patientId:
                      call.patient?.id ?? null,
                  patientName:
                      call.patient
                          ? `${call.patient.firstName} ${call.patient.lastName}`
                          : 'Unmatched patient',
                  preview: call.note,
                  status: call.callStatus,
                  callStatus: call.callStatus,
                  secondaryStatus:
                      call.followUpStatus,
                  matchStatus:
                      call.patientMatchStatus,
                  triageStatus:
                      call.triageStatus,
                  resolved:
                      call.followUpStatus ===
                      'RESOLVED',
                  dismissed:
                      call.triageStatus !==
                      'ACTIVE',
                  needsAttention:
                      call.triageStatus === 'ACTIVE' &&
                      call.patient !== null &&
                      ((call.direction === 'INBOUND' &&
                          call.callStatus === 'MISSED' &&
                          call.followUpStatus === 'NOT_REVIEWED') ||
                        (call.direction === 'OUTBOUND' &&
                          call.callStatus === 'NO_ANSWER' &&
                          call.followUpStatus === 'NOT_REVIEWED') ||
                        call.followUpStatus === 'FOLLOW_UP_REQUIRED'),
                  unmatched:
                      call.patientMatchStatus !== 'MATCHED',
                }),
            )

        const emailItems =
            unmatchedEmails.map(
                (email) => ({
                  type: 'EMAIL' as const,
                  direction: email.direction,
                  id: email.id,
                  occurredAt: email.sentAt,
                  title:
                      email.subject ||
                      (email.direction ===
                      'OUTBOUND'
                          ? 'Sent email'
                          : 'Received email'),
                  contact:
                      email.direction ===
                      'OUTBOUND'
                          ? email.toAddress
                          : email.fromAddress,
                  patientId:
                      email.patient?.id ?? null,
                  patientName:
                      email.patient
                          ? `${email.patient.firstName} ${email.patient.lastName}`
                          : 'Unmatched patient',
                  preview: email.bodyText,
                  status: email.emailStatus,
                  callStatus: null,
                  secondaryStatus: null,
                  matchStatus:
                      email.patientMatchStatus,
                  triageStatus:
                      email.triageStatus,
                  resolved:
                      email.emailStatus ===
                      'RESOLVED',
                  dismissed:
                      email.triageStatus !==
                      'ACTIVE',
                  needsAttention:
                      email.triageStatus === 'ACTIVE' &&
                      email.patient !== null &&
                      ((email.direction === 'INBOUND' &&
                          (email.emailStatus === 'UNREAD' ||
                            email.emailStatus === 'AWAITING_REPLY')) ||
                        (email.direction === 'OUTBOUND' &&
                          email.emailStatus === 'FAILED')),
                  unmatched:
                      email.patientMatchStatus !== 'MATCHED',
                }),
            )

        const noteItems =
            historyNotes.map(
                ({ activity, patientId, patientName }) => ({
                  type: 'NOTE' as const,
                  direction: null,
                  id: activity.id,
                  occurredAt: activity.occurredAt,
                  title: 'Staff note',
                  contact: null,
                  patientId,
                  patientName,
                  preview: activity.text,
                  status: null,
                  callStatus: null,
                  secondaryStatus: null,
                  matchStatus: 'MATCHED',
                  triageStatus: 'ACTIVE',
                  resolved: false,
                  dismissed: false,
                  needsAttention: false,
                  unmatched: false,
                }),
            )

        return [
          ...callItems,
          ...emailItems,
          ...noteItems,
        ].sort(
            (left, right) =>
                new Date(
                    right.occurredAt,
                ).getTime() -
                new Date(
                    left.occurredAt,
                ).getTime(),
        )
      }, [
        unmatchedCalls,
        unmatchedEmails,
        historyNotes,
      ])

  const todayHistoryDate =
      toLocalDateValue(new Date())

  const earliestHistoryDate =
      communicationHistory.length > 0
          ? localDateForInstant(
              communicationHistory[
                  communicationHistory.length - 1
              ].occurredAt,
          )
          : todayHistoryDate

  /*
   * Inbox is an operational view for TODAY only.
   * Resolved / Dismissed / All therefore describe today's
   * communication, while the separate History view handles
   * arbitrary dates and all-time browsing.
   */
  const inboxDailyHistory =
      useMemo(() => {
        return communicationHistory.filter(
            (item) => {
              if (
                  localDateForInstant(
                      item.occurredAt,
                  ) !== todayHistoryDate
              ) {
                return false
              }

              if (inboxTab === 'DISMISSED') {
                return item.dismissed
              }

              if (inboxTab === 'RESOLVED') {
                return item.resolved
              }

              return inboxTab === 'ALL'
            },
        )
      }, [
        communicationHistory,
        inboxTab,
        todayHistoryDate,
      ])

  /*
   * History is the complete communication archive. Date controls
   * decide which part of that archive is visible.
   */
  const filteredHistory =
      useMemo(() => {
        return communicationHistory.filter(
            (item) => {
              const itemDate =
                  localDateForInstant(
                      item.occurredAt,
                  )

              const yesterday =
                  shiftDateValue(todayHistoryDate, -1)

              const dateMatches =
                  historyDateMode === 'ALL_TIME' ||
                  (historyDateMode === 'TODAY' &&
                      itemDate === todayHistoryDate) ||
                  (historyDateMode === 'YESTERDAY' &&
                      itemDate === yesterday) ||
                  (historyDateMode === 'CUSTOM' &&
                      itemDate >= historyFromDate &&
                      itemDate <= historyToDate)

              const typeMatches =
                  historyTypes.includes(item.type)

              const outcomeMatches =
                  historyCallOutcomes.length === 0 ||
                  (item.type === 'CALL' &&
                      item.callStatus !== null &&
                      historyCallOutcomes.includes(
                          item.callStatus as HistoryCallOutcome,
                      ))

              const workflowMatches =
                  historyWorkflows.length === 0 ||
                  historyWorkflows.some(
                      (workflow) =>
                          (workflow === 'NEEDS_ATTENTION' &&
                              item.needsAttention) ||
                          (workflow === 'RESOLVED' &&
                              item.resolved) ||
                          (workflow === 'DISMISSED' &&
                              item.dismissed) ||
                          (workflow === 'UNMATCHED' &&
                              item.unmatched),
                  )

              return dateMatches &&
                  typeMatches &&
                  outcomeMatches &&
                  workflowMatches
            },
        )
      }, [
        communicationHistory,
        historyDateMode,
        historyFromDate,
        historyToDate,
        historyTypes,
        historyCallOutcomes,
        historyWorkflows,
        todayHistoryDate,
      ])

  const historyTotalPages =
      Math.max(
          1,
          Math.ceil(
              filteredHistory.length /
              HISTORY_PAGE_SIZE,
          ),
      )

  const pagedHistory =
      useMemo(() => {
        const start =
            (historyPage - 1) *
            HISTORY_PAGE_SIZE

        return filteredHistory.slice(
            start,
            start + HISTORY_PAGE_SIZE,
        )
      }, [
        filteredHistory,
        historyPage,
      ])

  useEffect(() => {
    setHistoryPage(1)
  }, [
    historyDateMode,
    historyFromDate,
    historyToDate,
    historyTypes,
    historyCallOutcomes,
    historyWorkflows,
  ])

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages)
    }
  }, [
    historyPage,
    historyTotalPages,
  ])

  const pendingSameSourceCount =
      useMemo(() => {
        if (pendingPatientAssignment === null) {
          return 0
        }

        if (pendingPatientAssignment.type === 'CALL') {
          return unmatchedCalls.filter(
              (call) =>
                  call.id !== pendingPatientAssignment.id &&
                  call.patientMatchStatus !== 'MATCHED' &&
                  call.triageStatus === 'ACTIVE' &&
                  call.counterpartyNumber === pendingPatientAssignment.contact,
          ).length
        }

        return unmatchedEmails.filter(
            (email) =>
                email.id !== pendingPatientAssignment.id &&
                email.patientMatchStatus !== 'MATCHED' &&
                email.triageStatus === 'ACTIVE' &&
                email.fromAddress === pendingPatientAssignment.contact,
        ).length
      }, [
        pendingPatientAssignment,
        unmatchedCalls,
        unmatchedEmails,
      ])

  const assignmentPatients =
      useMemo(() => {
        const query =
            assignmentSearch
                .trim()
                .toLowerCase()

        const matches =
            query
                ? patients.filter(
                    (patient) => {
                      const fullName =
                          `${patient.firstName} ${patient.lastName}`
                              .toLowerCase()

                      return (
                          fullName.includes(
                              query,
                          ) ||
                          String(
                              patient.id,
                          ).includes(
                              query,
                          )
                      )
                    },
                )
                : patients

        return matches.slice(0, 10)
      }, [
        patients,
        assignmentSearch,
      ])

  const inboxTotalCount =
      inboxItems.length +
      unmatchedCommunications.length

  /* =========================================
     FILTERED ACTIVITY
     ========================================= */

  const visibleActivities =
      useMemo(() => {
        if (
            activityFilter ===
            'ALL' ||
            activityFilter ===
            'REMOVED'
        ) {
          return activities
        }

        return activities.filter(
            (activity) =>
                activity.type ===
                activityFilter,
        )
      }, [
        activities,
        activityFilter,
      ])

  /* =========================================
     SELECTED PATIENT
     ========================================= */

  const selectedPatient =
      patients.find(
          (patient) =>
              patient.id ===
              selectedPatientId,
      ) ?? null

  const primaryEmailAddress =
      getPrimaryEmailAddress(
          emailAddresses,
      )

  /* =========================================
     INBOX
     ========================================= */

  async function refreshInbox() {
    setLoadingInbox(true)
    setInboxError(null)

    try {
      const loadedInbox =
          await getInbox()

      setInboxItems(
          loadedInbox,
      )
    } catch (error) {
      console.error(error)

      setInboxError(
          'Could not load the inbox.',
      )
    } finally {
      setLoadingInbox(false)
    }
  }

  async function refreshUnmatched() {
    setLoadingUnmatched(true)
    setUnmatchedError(null)

    try {
      const [
        loadedCalls,
        loadedEmails,
      ] = await Promise.all([
        getCalls(),
        getEmails(),
      ])

      setUnmatchedCalls(
          loadedCalls,
      )

      setUnmatchedEmails(
          loadedEmails,
      )
    } catch (error) {
      console.error(error)

      setUnmatchedError(
          'Could not load unmatched communication.',
      )
    } finally {
      setLoadingUnmatched(false)
    }
  }

  async function refreshHistory() {
    setLoadingHistory(true)
    setHistoryError(null)

    try {
      const [loadedCalls, loadedEmails, historyPatients] =
          await Promise.all([
            getCalls(),
            getEmails(),
            getPatients(),
          ])

      const patientActivityGroups =
          await Promise.all(
              historyPatients.map(async (patient) => ({
                patient,
                activities: await getPatientActivity(patient.id),
              })),
          )

      setUnmatchedCalls(loadedCalls)
      setUnmatchedEmails(loadedEmails)
      setHistoryNotes(
          patientActivityGroups.flatMap(
              ({ patient, activities }) =>
                  activities
                      .filter((activity) => activity.type === 'NOTE')
                      .map((activity) => ({
                        activity,
                        patientId: patient.id,
                        patientName: `${patient.firstName} ${patient.lastName}`,
                      })),
          ),
      )
    } catch (error) {
      console.error(error)
      setHistoryError(
          'Could not load communication history.',
      )
    } finally {
      setLoadingHistory(false)
    }
  }

  function openPatientAssignment(
      type: 'CALL' | 'EMAIL',
      id: number,
      label: string,
      contact: string,
      canReuseSource: boolean,
  ) {
    setPendingPatientAssignment({
      type,
      id,
      label,
      contact,
      canReuseSource,
    })
    setAssignmentSearch('')
    setAssignmentPatientId(null)
    setAssignSameSource(true)
    setSaveSourceAsContact(false)
    setAssignmentError(null)
  }

  function closePatientAssignment() {
    if (assignmentRunning) {
      return
    }

    setPendingPatientAssignment(null)
    setAssignmentSearch('')
    setAssignmentPatientId(null)
    setAssignSameSource(true)
    setSaveSourceAsContact(false)
    setAssignmentError(null)
  }

  async function handleAssignPatient() {
    if (
        pendingPatientAssignment === null ||
        assignmentPatientId === null
    ) {
      setAssignmentError(
          'Choose a patient first.',
      )
      return
    }

    setAssignmentRunning(true)
    setAssignmentError(null)
    setUnmatchedError(null)

    try {
      if (
          pendingPatientAssignment.type ===
          'CALL'
      ) {
        await assignCallPatient(
            pendingPatientAssignment.id,
            {
              patientId:
                  assignmentPatientId,
              assignSameCaller:
                  assignSameSource,
              saveCallerAsContact:
                  saveSourceAsContact,
            },
        )
      } else {
        await assignEmailPatient(
            pendingPatientAssignment.id,
            {
              patientId:
                  assignmentPatientId,
              assignSameSender:
                  assignSameSource,
              saveSenderAsContact:
                  saveSourceAsContact,
            },
        )
      }

      setPendingPatientAssignment(null)
      setAssignmentSearch('')
      setAssignmentPatientId(null)
      setAssignSameSource(true)
      setSaveSourceAsContact(false)

      await Promise.all([
        refreshUnmatched(),
        refreshInbox(),
      ])
    } catch (error) {
      console.error(error)

      setAssignmentError(
          'Could not assign this communication to the patient.',
      )
    } finally {
      setAssignmentRunning(false)
    }
  }

  function openDismissal(
      type: 'CALL' | 'EMAIL',
      id: number,
      label: string,
      contact: string,
      canReuseSource: boolean,
  ) {
    setPendingDismissal({
      type,
      id,
      label,
      contact,
      canReuseSource,
    })
    setTreatFutureAsSpam(false)
    setDismissalError(null)
  }

  function closeDismissal() {
    if (dismissalRunning) {
      return
    }

    setPendingDismissal(null)
    setTreatFutureAsSpam(false)
    setDismissalError(null)
  }

  async function handleDismissCommunication() {
    if (pendingDismissal === null) {
      return
    }

    setDismissalRunning(true)
    setDismissalError(null)

    try {
      if (pendingDismissal.type === 'CALL') {
        await dismissCall(
            pendingDismissal.id,
            {
              treatFutureFromSenderAsSpam:
                  treatFutureAsSpam,
            },
        )
      } else {
        await dismissEmail(
            pendingDismissal.id,
            {
              treatFutureFromSenderAsSpam:
                  treatFutureAsSpam,
            },
        )
      }

      setPendingDismissal(null)
      setTreatFutureAsSpam(false)

      await Promise.all([
        refreshUnmatched(),
        refreshInbox(),
      ])
    } catch (error) {
      console.error(error)
      setDismissalError(
          'Could not dismiss this communication.',
      )
    } finally {
      setDismissalRunning(false)
    }
  }

  async function handleRestoreDismissedCommunication(
      type: ActivityType,
      id: number,
  ) {
    if (type === 'NOTE') {
      return
    }

    setUnmatchedError(null)

    try {
      if (type === 'CALL') {
        await restoreCall(id)
      } else {
        await restoreEmail(id)
      }

      await Promise.all([
        refreshUnmatched(),
        refreshInbox(),
      ])
    } catch (error) {
      console.error(error)
      setUnmatchedError(
          'Could not restore this communication.',
      )
    }
  }

  function openPatientsView() {
    setAppView('PATIENTS')
    setInboxError(null)
  }

  function openInboxView() {
    resetComposerState()
    setEditingPatient(false)
    setCreatingPatient(false)
    setPendingActivityAction(null)
    setOpenActivityMenuKey(null)
    setActivityActionError(null)
    setInboxTab('ATTENTION')
    setAppView('INBOX')
    void refreshInbox()
    void refreshUnmatched()
  }

  function openHistoryView() {
    resetComposerState()
    setEditingPatient(false)
    setCreatingPatient(false)
    setPendingActivityAction(null)
    setOpenActivityMenuKey(null)
    setActivityActionError(null)

    const today =
        toLocalDateValue(new Date())

    setHistoryFromDate(today)
    setHistoryToDate(today)
    setHistoryDateMode('TODAY')
    setHistoryTypes(['CALL', 'EMAIL', 'NOTE'])
    setHistoryCallOutcomes([])
    setHistoryWorkflows([])
    setHistoryFiltersExpanded(false)
    setHistoryPage(1)
    setAppView('HISTORY')
    void refreshHistory()
  }

  function toggleHistoryType(type: ActivityType) {
    setHistoryTypes((current) =>
        current.includes(type)
            ? current.filter((item) => item !== type)
            : [...current, type],
    )
  }

  function toggleHistoryCallOutcome(outcome: HistoryCallOutcome) {
    setHistoryCallOutcomes((current) =>
        current.includes(outcome)
            ? current.filter((item) => item !== outcome)
            : [...current, outcome],
    )
  }

  function toggleHistoryWorkflow(workflow: HistoryWorkflow) {
    setHistoryWorkflows((current) =>
        current.includes(workflow)
            ? current.filter((item) => item !== workflow)
            : [...current, workflow],
    )
  }

  function openPatientFromInbox(
      patientId: number,
  ) {
    setAppView('PATIENTS')
    selectPatient(patientId)
    void refreshActivity(patientId)
  }

  /* =========================================
     GENERAL ACTIONS
     ========================================= */

  function resetComposerState() {
    setComposerMode(null)
    setEditingNoteId(null)
    setEditingCallId(null)
    setEditingEmailId(null)
    setEmailSubject('')
    setSelectedEmailAddressId(null)
    setReplyToEmailId(null)
    setSendToAllEmails(false)
    setComposerText('')
    setComposerError(null)
    setEmailSent(false)
    setNoteSaved(false)
  }

  function openCreatePatient() {
    resetComposerState()
    setEditingPatient(false)
    setCreateFirstName('')
    setCreateLastName('')
    setCreateDateOfBirth('')
    setCreatePhoneNumber('')
    setCreateEmailAddress('')
    setCreatePatientError(null)
    setCreatingPatient(true)
  }

  function closeCreatePatient() {
    if (creatingPatientRequest) {
      return
    }

    setCreatingPatient(false)
    setCreatePatientError(null)
    setCreateFirstName('')
    setCreateLastName('')
    setCreateDateOfBirth('')
    setCreatePhoneNumber('')
    setCreateEmailAddress('')
  }

  async function handleCreatePatient() {
    const firstName =
        createFirstName.trim()

    const lastName =
        createLastName.trim()

    const dateOfBirth =
        parseDateOfBirthInput(
            createDateOfBirth,
        )

    const phoneNumber =
        createPhoneNumber.trim()

    const emailAddress =
        createEmailAddress.trim()

    if (!firstName || !lastName) {
      setCreatePatientError(
          'First name and last name are required.',
      )
      return
    }

    if (dateOfBirth === undefined) {
      setCreatePatientError(
          'Enter date of birth as DD/MM/YYYY.',
      )
      return
    }

    setCreatingPatientRequest(true)
    setCreatePatientError(null)

    try {
      const createdPatient =
          await createPatient({
            firstName,
            lastName,
            dateOfBirth,
            phoneNumbers: phoneNumber
                ? [phoneNumber]
                : [],
            emailAddresses: emailAddress
                ? [emailAddress]
                : [],
          })

      setPatients(
          (currentPatients) => [
            createdPatient,
            ...currentPatients.filter(
                (patient) =>
                    patient.id !==
                    createdPatient.id,
            ),
          ],
      )

      setSearch('')
      setSelectedPatientId(
          createdPatient.id,
      )
      setActivityFilter('ALL')
      setOpenActivityMenuKey(null)
      setPendingActivityAction(null)
      setActivityActionError(null)
      setCreatingPatient(false)
      setCreateFirstName('')
      setCreateLastName('')
      setCreateDateOfBirth('')
      setCreatePhoneNumber('')
      setCreateEmailAddress('')
    } catch (error) {
      console.error(error)

      setCreatePatientError(
          'Could not create this patient.',
      )
    } finally {
      setCreatingPatientRequest(false)
    }
  }

  function selectPatient(
      patientId: number,
  ) {
    setSelectedPatientId(
        patientId,
    )

    setActivityFilter('ALL')
    setOpenActivityMenuKey(null)
    setPendingActivityAction(
        null,
    )
    setActivityActionError(null)

    setEditingPatient(false)
    setPatientEditError(null)
    setPatientSaveConfirmation(null)
    setEditDateOfBirth('')
    setNewPhoneNumber('')
    setManagingPhone(false)
    setNewEmailAddress('')
    setManagingEmail(false)

    resetComposerState()
  }

  function openPatientEditor() {
    if (!selectedPatient) {
      return
    }

    resetComposerState()
    setEditFirstName(
        selectedPatient.firstName,
    )
    setEditLastName(
        selectedPatient.lastName,
    )
    setEditDateOfBirth(
        selectedPatient.dateOfBirth
            ? formatDateOfBirth(
                selectedPatient.dateOfBirth,
            )
            : '',
    )
    setNewPhoneNumber('')
    setNewEmailAddress('')
    setPendingPhoneRemovalIds([])
    setPendingEmailRemovalIds([])
    setPatientEditError(null)
    setPatientSaveConfirmation(null)
    setEditingPatient(true)
  }

  function closePatientEditor() {
    if (
        savingPatient ||
        managingPhone ||
        managingEmail
    ) {
      return
    }

    setEditingPatient(false)
    setPatientEditError(null)
    setEditDateOfBirth('')
    setNewPhoneNumber('')
    setNewEmailAddress('')
    setPendingPhoneRemovalIds([])
    setPendingEmailRemovalIds([])
  }

  function replacePatientInState(
      updatedPatient: Patient,
  ) {
    setPatients(
        (currentPatients) =>
            currentPatients.map(
                (patient) =>
                    patient.id ===
                    updatedPatient.id
                        ? updatedPatient
                        : patient,
            ),
    )
  }

  async function handleSavePatient() {
    if (
        selectedPatientId === null ||
        selectedPatient === null
    ) {
      return
    }

    const firstName =
        editFirstName.trim()

    const lastName =
        editLastName.trim()

    const dateOfBirth =
        parseDateOfBirthInput(
            editDateOfBirth,
        )

    const pendingPhoneNumber =
        newPhoneNumber.trim()

    const pendingEmailAddress =
        newEmailAddress.trim()

    if (!firstName || !lastName) {
      setPatientEditError(
          'First name and last name are required.',
      )
      return
    }

    if (dateOfBirth === undefined) {
      setPatientEditError(
          'Enter date of birth as DD/MM/YYYY.',
      )
      return
    }

    const detailsChanged =
        firstName !== selectedPatient.firstName ||
        lastName !== selectedPatient.lastName ||
        dateOfBirth !== selectedPatient.dateOfBirth

    const phoneAdded =
        Boolean(pendingPhoneNumber)

    const emailAdded =
        Boolean(pendingEmailAddress)

    const phoneRemoved =
        pendingPhoneRemovalIds.length > 0

    const emailRemoved =
        pendingEmailRemovalIds.length > 0

    const phoneChanged =
        phoneAdded || phoneRemoved

    const emailChanged =
        emailAdded || emailRemoved

    setSavingPatient(true)
    setPatientEditError(null)
    setPatientSaveConfirmation(null)

    try {
      if (detailsChanged) {
        const updatedPatient =
            await updatePatient(
                selectedPatientId,
                {
                  firstName,
                  lastName,
                  dateOfBirth,
                },
            )

        replacePatientInState(
            updatedPatient,
        )
      }

      if (phoneAdded) {
        const updatedPatient =
            await addPhoneNumber(
                selectedPatientId,
                {
                  number:
                      pendingPhoneNumber,
                },
            )

        replacePatientInState(
            updatedPatient,
        )
      }

      for (const phoneNumberId of pendingPhoneRemovalIds) {
        const updatedPatient =
            await deactivatePhoneNumber(
                selectedPatientId,
                phoneNumberId,
            )

        replacePatientInState(
            updatedPatient,
        )
      }

      if (emailAdded) {
        await addEmailAddress(
            selectedPatientId,
            {
              address:
                  pendingEmailAddress,
            },
        )
      }

      for (const emailAddressId of pendingEmailRemovalIds) {
        await deactivateEmailAddress(
            selectedPatientId,
            emailAddressId,
        )
      }

      if (emailAdded || emailRemoved) {
        const refreshedAddresses =
            await getPatientEmailAddresses(
                selectedPatientId,
            )

        setEmailAddresses(
            refreshedAddresses,
        )
      }

      let confirmation =
          'No changes needed ✓'

      if (
          detailsChanged &&
          phoneChanged &&
          emailChanged
      ) {
        confirmation =
            'Patient details, phone number and email updated ✓'
      } else if (
          phoneChanged &&
          emailChanged
      ) {
        confirmation =
            'Phone number and email updated ✓'
      } else if (
          detailsChanged &&
          phoneChanged
      ) {
        confirmation =
            'Patient details and phone number updated ✓'
      } else if (
          detailsChanged &&
          emailChanged
      ) {
        confirmation =
            'Patient details and email updated ✓'
      } else if (phoneChanged) {
        confirmation =
            'Phone number updated ✓'
      } else if (emailChanged) {
        confirmation =
            'Email updated ✓'
      } else if (detailsChanged) {
        confirmation =
            'Patient details updated ✓'
      }

      setPatientSaveConfirmation(
          confirmation,
      )

      setEditingPatient(false)
      setNewPhoneNumber('')
      setNewEmailAddress('')
      setPendingPhoneRemovalIds([])
      setPendingEmailRemovalIds([])
    } catch (error) {
      console.error(error)

      setPatientEditError(
          'Could not save all patient changes. Any changes that completed successfully have been kept; please review and try again.',
      )
    } finally {
      setSavingPatient(false)
    }
  }

  async function handleAddPhoneNumber() {
    if (selectedPatientId === null) {
      return
    }

    const number =
        newPhoneNumber.trim()

    if (!number) {
      setPatientEditError(
          'Enter a phone number first.',
      )
      return
    }

    setManagingPhone(true)
    setPatientEditError(null)

    try {
      const updatedPatient =
          await addPhoneNumber(
              selectedPatientId,
              {
                number,
              },
          )

      replacePatientInState(
          updatedPatient,
      )

      setNewPhoneNumber('')
      setPatientSaveConfirmation(
          'Phone number updated ✓',
      )
    } catch (error) {
      console.error(error)

      setPatientEditError(
          'Could not add this phone number.',
      )
    } finally {
      setManagingPhone(false)
    }
  }

  async function handleSetPrimaryPhoneNumber(
      phoneNumberId: number,
  ) {
    if (selectedPatientId === null) {
      return
    }

    setManagingPhone(true)
    setPatientEditError(null)

    try {
      const updatedPatient =
          await setPrimaryPhoneNumber(
              selectedPatientId,
              phoneNumberId,
          )

      replacePatientInState(
          updatedPatient,
      )
      setPatientSaveConfirmation(
          'Primary phone number updated ✓',
      )
    } catch (error) {
      console.error(error)

      setPatientEditError(
          'Could not make this the primary phone number.',
      )
    } finally {
      setManagingPhone(false)
    }
  }

  function handleDeactivatePhoneNumber(
      phoneNumberId: number,
  ) {
    setPendingPhoneRemovalIds(
        (currentIds) =>
            currentIds.includes(phoneNumberId)
                ? currentIds
                : [...currentIds, phoneNumberId],
    )

    setPatientEditError(null)
    setPatientSaveConfirmation(
        'Phone number will be removed when you save changes.',
    )
  }

  async function handleAddEmailAddress() {
    if (selectedPatientId === null) {
      return
    }

    const address =
        newEmailAddress.trim()

    if (!address) {
      setPatientEditError(
          'Enter an email address first.',
      )
      return
    }

    setManagingEmail(true)
    setPatientEditError(null)

    try {
      await addEmailAddress(
          selectedPatientId,
          {
            address,
          },
      )

      const refreshedAddresses =
          await getPatientEmailAddresses(
              selectedPatientId,
          )

      setEmailAddresses(
          refreshedAddresses,
      )

      setNewEmailAddress('')
    } catch (error) {
      console.error(error)

      setPatientEditError(
          'Could not add this email address.',
      )
    } finally {
      setManagingEmail(false)
    }
  }

  async function handleSetPrimaryEmailAddress(
      emailAddressId: number,
  ) {
    if (selectedPatientId === null) {
      return
    }

    setManagingEmail(true)
    setPatientEditError(null)

    try {
      const updatedAddresses =
          await setPrimaryEmailAddress(
              selectedPatientId,
              emailAddressId,
          )

      setEmailAddresses(
          updatedAddresses,
      )
      setPatientSaveConfirmation(
          'Primary email updated ✓',
      )
    } catch (error) {
      console.error(error)

      setPatientEditError(
          'Could not make this the primary email address.',
      )
    } finally {
      setManagingEmail(false)
    }
  }

  function handleDeactivateEmailAddress(
      emailAddressId: number,
  ) {
    setPendingEmailRemovalIds(
        (currentIds) =>
            currentIds.includes(emailAddressId)
                ? currentIds
                : [...currentIds, emailAddressId],
    )

    setPatientEditError(null)
    setPatientSaveConfirmation(
        'Email will be removed when you save changes.',
    )
  }

  function selectActivityFilter(
      filter: ActivityFilter,
  ) {
    setActivityFilter(filter)
    setOpenActivityMenuKey(null)
    setPendingActivityAction(
        null,
    )
    setActivityActionError(null)
  }

  function openEmailComposer() {
    setComposerMode('EMAIL')
    setEditingNoteId(null)
    setEditingCallId(null)
    setEditingEmailId(null)
    setEmailSubject('')
    setSelectedEmailAddressId(
        primaryEmailAddress?.id ?? null,
    )
    setReplyToEmailId(null)
    setSendToAllEmails(false)
    setComposerText('')
    setComposerError(null)
    setEmailSent(false)
    setNoteSaved(false)
  }

  function openReplyComposer(
      activity: PatientActivity,
  ) {
    if (
        activity.type !== 'EMAIL' ||
        activity.emailDirection !== 'INBOUND' ||
        activity.removedAt !== null
    ) {
      return
    }

    const matchingAddress =
        emailAddresses.find(
            (address) =>
                address.address.toLowerCase() ===
                activity.fromAddress?.toLowerCase(),
        )

    const originalSubject =
        activity.emailSubject?.trim() ?? ''

    setComposerMode('EMAIL')
    setEditingNoteId(null)
    setEditingCallId(null)
    setEditingEmailId(null)
    setReplyToEmailId(activity.id)
    setEmailSubject(
        originalSubject
            ? originalSubject.toLowerCase().startsWith('re:')
                ? originalSubject
                : `Re: ${originalSubject}`
            : 'Re:',
    )
    setSelectedEmailAddressId(
        matchingAddress?.id ??
        primaryEmailAddress?.id ??
        null,
    )
    setSendToAllEmails(false)
    setComposerText('')
    setComposerError(null)
    setEmailSent(false)
    setNoteSaved(false)
  }

  function openNoteComposer() {
    setComposerMode('NOTE')
    setEditingNoteId(null)
    setEditingCallId(null)
    setEditingEmailId(null)
    setEmailSubject('')
    setComposerText('')
    setComposerError(null)
    setEmailSent(false)
    setNoteSaved(false)
  }

  function openEditNoteComposer(
      activity: PatientActivity,
  ) {
    if (
        activity.type !== 'NOTE'
    ) {
      return
    }

    setOpenActivityMenuKey(null)

    setComposerMode('NOTE')
    setEditingNoteId(activity.id)
    setEditingCallId(null)
    setEditingEmailId(null)
    setEmailSubject('')
    setComposerText(
        activity.text ?? '',
    )
    setComposerError(null)
    setEmailSent(false)
    setNoteSaved(false)
  }

  function openCallNoteComposer(
      activity: PatientActivity,
  ) {
    if (
        activity.type !== 'CALL' ||
        activity.removedAt !== null
    ) {
      return
    }

    setOpenActivityMenuKey(null)

    setComposerMode('CALL_NOTE')
    setEditingNoteId(null)
    setEditingCallId(activity.id)
    setEditingEmailId(null)
    setEmailSubject('')
    setComposerText(
        activity.staffNote ?? '',
    )
    setComposerError(null)
    setEmailSent(false)
    setNoteSaved(false)
  }

  function openEmailNoteComposer(
      activity: PatientActivity,
  ) {
    if (
        activity.type !== 'EMAIL' ||
        activity.removedAt !== null
    ) {
      return
    }

    setOpenActivityMenuKey(null)

    setComposerMode('EMAIL_NOTE')
    setEditingNoteId(null)
    setEditingCallId(null)
    setEditingEmailId(activity.id)
    setEmailSubject('')
    setComposerText(
        activity.staffNote ?? '',
    )
    setComposerError(null)
    setEmailSent(false)
    setNoteSaved(false)
  }

  function closeComposer() {
    if (
        sendingEmail ||
        savingNote
    ) {
      return
    }

    resetComposerState()
  }

  async function refreshActivity(
      patientId: number,
  ) {
    const refreshedActivity =
        activityFilter ===
        'REMOVED'
            ? await getRemovedPatientActivity(
                patientId,
            )
            : await getPatientActivity(
                patientId,
            )

    setActivities(
        refreshedActivity,
    )
  }

  /* =========================================
     REMOVE / RESTORE ACTIVITY
     ========================================= */

  function requestRemoveActivity(
      activity: PatientActivity,
  ) {
    setOpenActivityMenuKey(null)

    setPendingActivityAction({
      action: 'REMOVE',
      activity,
    })

    setActivityActionError(null)
  }

  function requestRestoreActivity(
      activity: PatientActivity,
  ) {
    setPendingActivityAction({
      action: 'RESTORE',
      activity,
    })

    setActivityActionError(null)
  }

  function cancelActivityAction() {
    if (activityActionRunning) {
      return
    }

    setPendingActivityAction(
        null,
    )
  }

  async function confirmActivityAction() {
    if (
        selectedPatientId === null ||
        pendingActivityAction ===
        null
    ) {
      return
    }

    setActivityActionRunning(
        true,
    )

    setActivityActionError(
        null,
    )

    try {
      if (
          pendingActivityAction.action ===
          'REMOVE'
      ) {
        await removePatientActivity(
            selectedPatientId,
            pendingActivityAction
                .activity.type,
            pendingActivityAction
                .activity.id,
        )
      } else {
        await restorePatientActivity(
            selectedPatientId,
            pendingActivityAction
                .activity.type,
            pendingActivityAction
                .activity.id,
        )
      }

      setPendingActivityAction(
          null,
      )

      await Promise.all([
        refreshActivity(
            selectedPatientId,
        ),
        refreshInbox(),
      ])
    } catch (error) {
      console.error(error)

      setActivityActionError(
          pendingActivityAction.action ===
          'REMOVE'
              ? 'Could not remove this item from activity.'
              : 'Could not restore this item.',
      )
    } finally {
      setActivityActionRunning(
          false,
      )
    }
  }

  /* =========================================
     SEND EMAIL
     ========================================= */

  async function handleSendEmail() {
    if (
        selectedPatientId === null
    ) {
      return
    }

    if (emailAddresses.length === 0) {
      setComposerError(
          'This patient does not have an active email address.',
      )

      return
    }

    if (
        !sendToAllEmails &&
        selectedEmailAddressId === null
    ) {
      setComposerError(
          'Choose an email address.',
      )

      return
    }

    if (!composerText.trim()) {
      setComposerError(
          'Email message cannot be empty.',
      )

      return
    }

    setSendingEmail(true)
    setEmailSent(false)
    setComposerError(null)

    try {
      const results =
          await sendPatientEmails(
              selectedPatientId,
              {
                subject:
                    emailSubject.trim(),

                bodyText:
                    composerText.trim(),

                emailAddressId:
                    sendToAllEmails
                        ? null
                        : selectedEmailAddressId,

                sendToAllEmails,

                replyToEmailId,
              },
          )

      if (results.length === 0) {
        setComposerError(
            'The email send returned no delivery results.',
        )

        return
      }

      const failedCount =
          results.filter(
              (result) =>
                  result.emailStatus ===
                  'FAILED',
          ).length

      const sentCount =
          results.length -
          failedCount

      await Promise.all([
        refreshActivity(
            selectedPatientId,
        ),
        refreshInbox(),
      ])

      if (failedCount === results.length) {
        setComposerError(
            results.length === 1
                ? 'The email could not be sent. The failed attempt has been recorded in the patient history.'
                : 'None of the emails could be sent. The failed attempts have been recorded in the patient history.',
        )

        return
      }

      if (failedCount > 0) {
        setEmailSent(true)

        setComposerError(
            `${sentCount} of ${results.length} emails were sent. ${failedCount} failed. The results have been recorded in the patient history.`,
        )

        return
      }

      setEmailSent(true)

      await new Promise(
          (resolve) =>
              setTimeout(
                  resolve,
                  900,
              ),
      )

      resetComposerState()
    } catch (error) {
      console.error(error)

      setComposerError(
          'Something went wrong while sending the email.',
      )
    } finally {
      setSendingEmail(false)
    }
  }

  /* =========================================
     SAVE / EDIT NOTE
     ========================================= */

  async function handleSaveNote() {
    if (
        selectedPatientId === null
    ) {
      return
    }

    if (!composerText.trim()) {
      setComposerError(
          'Note cannot be empty.',
      )

      return
    }

    setSavingNote(true)
    setNoteSaved(false)
    setComposerError(null)

    try {
      if (
          editingNoteId !== null
      ) {
        await updatePatientNote(
            selectedPatientId,
            editingNoteId,
            {
              text:
                  composerText.trim(),
            },
        )
      } else {
        await createPatientNote(
            selectedPatientId,
            {
              text:
                  composerText.trim(),
            },
        )
      }

      setNoteSaved(true)

      const refreshPromise =
          refreshActivity(
              selectedPatientId,
          )

      await Promise.all([
        refreshPromise,

        new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    700,
                ),
        ),
      ])

      resetComposerState()
    } catch (error) {
      console.error(error)

      setComposerError(
          editingNoteId !== null
              ? 'Something went wrong while updating the note.'
              : 'Something went wrong while saving the note.',
      )
    } finally {
      setSavingNote(false)
    }
  }

  /* =========================================
     SAVE / EDIT CALL STAFF NOTE
     ========================================= */

  async function handleSaveCallNote() {
    if (
        selectedPatientId === null ||
        editingCallId === null
    ) {
      return
    }

    if (!composerText.trim()) {
      setComposerError(
          'Staff note cannot be empty.',
      )

      return
    }

    setSavingNote(true)
    setNoteSaved(false)
    setComposerError(null)

    try {
      await updateCallNote(
          editingCallId,
          {
            note:
                composerText.trim(),
          },
      )

      setNoteSaved(true)

      const refreshPromise =
          refreshActivity(
              selectedPatientId,
          )

      await Promise.all([
        refreshPromise,

        new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    700,
                ),
        ),
      ])

      resetComposerState()
    } catch (error) {
      console.error(error)

      setComposerError(
          'Something went wrong while saving the staff note.',
      )
    } finally {
      setSavingNote(false)
    }
  }

  /* =========================================
     UPDATE CALL FOLLOW-UP STATUS
     ========================================= */

  async function handleUpdateCallFollowUp(
      activity: PatientActivity,
      followUpStatus: CallFollowUpStatus,
  ) {
    if (
        activity.type !== 'CALL' ||
        activity.removedAt !== null
    ) {
      return
    }

    setUpdatingCallFollowUpId(
        activity.id,
    )
    setActivityActionError(null)
    setInboxError(null)

    try {
      await updateCallFollowUp(
          activity.id,
          {
            followUpStatus,
          },
      )

      const refreshes: Promise<void>[] = [
        refreshInbox(),
      ]

      if (selectedPatientId !== null) {
        refreshes.push(
            refreshActivity(
                selectedPatientId,
            ),
        )
      }

      await Promise.all(refreshes)
    } catch (error) {
      console.error(error)

      const message =
          'Could not update this call follow-up status.'

      setActivityActionError(message)
      setInboxError(message)
    } finally {
      setUpdatingCallFollowUpId(null)
    }
  }

  /* =========================================
     UPDATE INBOUND EMAIL ATTENTION STATUS
     ========================================= */

  async function handleUpdateEmailStatus(
      activity: PatientActivity,
      status: EmailAttentionStatus,
  ) {
    if (
        activity.type !== 'EMAIL' ||
        activity.emailDirection !== 'INBOUND' ||
        activity.removedAt !== null
    ) {
      return
    }

    setUpdatingEmailStatusId(
        activity.id,
    )
    setActivityActionError(null)
    setInboxError(null)

    try {
      await updateEmailStatus(
          activity.id,
          {
            status,
          },
      )

      const refreshes: Promise<void>[] = [
        refreshInbox(),
      ]

      if (selectedPatientId !== null) {
        refreshes.push(
            refreshActivity(
                selectedPatientId,
            ),
        )
      }

      await Promise.all(refreshes)
    } catch (error) {
      console.error(error)

      const message =
          'Could not update this email status.'

      setActivityActionError(message)
      setInboxError(message)
    } finally {
      setUpdatingEmailStatusId(null)
    }
  }

  /* =========================================
     SAVE / EDIT EMAIL STAFF NOTE
     ========================================= */

  async function handleSaveEmailNote() {
    if (
        selectedPatientId === null ||
        editingEmailId === null
    ) {
      return
    }

    if (!composerText.trim()) {
      setComposerError(
          'Staff note cannot be empty.',
      )

      return
    }

    setSavingNote(true)
    setNoteSaved(false)
    setComposerError(null)

    try {
      await updateEmailStaffNote(
          editingEmailId,
          {
            staffNote:
                composerText.trim(),
          },
      )

      setNoteSaved(true)

      const refreshPromise =
          refreshActivity(
              selectedPatientId,
          )

      await Promise.all([
        refreshPromise,

        new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    700,
                ),
        ),
      ])

      resetComposerState()
    } catch (error) {
      console.error(error)

      setComposerError(
          'Something went wrong while saving the staff note.',
      )
    } finally {
      setSavingNote(false)
    }
  }

  function renderCommunicationHistoryCards(
      items: CommunicationHistoryItem[],
      showRestoreDismissed: boolean,
  ) {
    return (
        <div className="inbox-history-list">
          {items.map(
              (item) => (
                  <article
                      key={`history-${item.type}-${item.id}`}
                      className="inbox-history-card"
                  >
                    <div className="inbox-history-card-main">
                      <div className="inbox-history-icon">
                        {item.type === 'CALL'
                            ? '☎'
                            : item.type === 'EMAIL'
                                ? '✉'
                                : '📝'}
                      </div>

                      <div className="inbox-history-card-content">
                        <div className="inbox-history-card-top">
                          <div>
                            {item.patientId !== null ? (
                                <button
                                    type="button"
                                    className="inbox-history-patient"
                                    onClick={() =>
                                        openPatientFromInbox(
                                            item.patientId!,
                                        )
                                    }
                                >
                                  {item.patientName}
                                </button>
                            ) : (
                                <strong className="inbox-history-unmatched">
                                  Unmatched patient
                                </strong>
                            )}

                            <div className="inbox-history-title-row">
                              <strong>
                                {item.title}
                              </strong>

                              {item.direction !== null && (
                                  <span className={`direction-badge ${item.direction.toLowerCase()}`}>
                                    {item.direction === 'OUTBOUND'
                                        ? 'Outgoing'
                                        : 'Incoming'}
                                  </span>
                              )}

                              {item.status !== null && (
                                  <span
                                      className="status-badge"
                                      style={getStatusBadgeStyle(item.status)}
                                  >
                                    {formatStatus(item.status)}
                                  </span>
                              )}

                              {item.secondaryStatus &&
                                  item.secondaryStatus !== 'NOT_REVIEWED' && (
                                      <span
                                          className="status-badge"
                                          style={
                                            getFollowUpBadgeStyle(
                                                item.secondaryStatus,
                                            )
                                          }
                                      >
                                        {formatStatus(
                                            item.secondaryStatus,
                                        )}
                                      </span>
                                  )}

                              {item.dismissed && (
                                  <span className="history-state-badge dismissed">
                                    Dismissed
                                  </span>
                              )}

                              {item.needsAttention && (
                                  <span className="history-state-badge attention">
                                    Needs attention
                                  </span>
                              )}

                              {item.resolved && (
                                  <span className="history-state-badge resolved">
                                    Resolved
                                  </span>
                              )}

                              {item.matchStatus !== 'MATCHED' && (
                                  <span className="history-state-badge unmatched">
                                    {formatStatus(
                                        item.matchStatus,
                                    )}
                                  </span>
                              )}
                            </div>
                          </div>

                          <time>
                            {formatActivityTime(
                                item.occurredAt,
                            )}
                          </time>
                        </div>

                        {item.contact !== null && (
                            <div className="inbox-history-contact">
                              <strong>{item.direction === 'OUTBOUND' ? 'To' : 'From'}:</strong>{' '}
                              {item.contact}
                            </div>
                        )}

                        {item.preview && (
                            <p className="inbox-history-preview">
                              {item.preview.length > 260
                                  ? `${item.preview.slice(
                                      0,
                                      260,
                                  )}…`
                                  : item.preview}
                            </p>
                        )}

                        <div className="inbox-history-card-actions">
                          {showRestoreDismissed &&
                              item.dismissed &&
                              item.type !== 'NOTE' && (
                                  <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() =>
                                          void handleRestoreDismissedCommunication(
                                              item.type,
                                              item.id,
                                          )
                                      }
                                  >
                                    Restore & allow sender
                                  </button>
                              )}

                          {item.patientId !== null && (
                              <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() =>
                                      openPatientFromInbox(
                                          item.patientId!,
                                      )
                                  }
                              >
                                Open patient
                              </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
              ),
          )}
        </div>
    )
  }

  /* =========================================
     UI
     ========================================= */

  return (
      <div className="app-shell">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <div className="brand">

            <div className="brand-mark">
              PM
            </div>

            <div>

              <div className="brand-name">
                Practice Memory
              </div>

              <div className="brand-subtitle">
                Patient communication
              </div>

            </div>

          </div>

          <nav className="navigation">

            <button
                className={`nav-item ${
                    appView === 'PATIENTS'
                        ? 'active'
                        : ''
                }`}
                onClick={openPatientsView}
            >
              <span>👥</span>
              Patients
            </button>

            <button
                className={`nav-item ${
                    appView === 'INBOX'
                        ? 'active'
                        : ''
                }`}
                onClick={openInboxView}
            >
              <span>📥</span>
              Inbox

              {inboxTotalCount > 0 && (
                  <span
                      style={{
                        marginLeft: 'auto',
                        minWidth: '20px',
                        height: '20px',
                        padding: '0 6px',
                        borderRadius: '999px',
                        background: '#c94c4c',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 800,
                      }}
                  >
                    {inboxTotalCount}
                  </span>
              )}
            </button>

            <button
                className={`nav-item ${
                    appView === 'HISTORY'
                        ? 'active'
                        : ''
                }`}
                onClick={openHistoryView}
            >
              <span>🕘</span>
              History
            </button>

          </nav>

        </aside>

        {/* MAIN */}

        <main className="main-content">

          <header className="topbar">

            <div>

              <h1>
                {appView === 'PATIENTS'
                    ? 'Patients'
                    : appView === 'INBOX'
                        ? 'Inbox'
                        : 'History'}
              </h1>

              <p>
                {appView === 'PATIENTS'
                    ? 'Communication history in one place'
                    : appView === 'INBOX'
                        ? 'Communication that needs staff attention'
                        : 'Everything that happened across the practice'}
              </p>

            </div>

            <div className="user-avatar">
              K
            </div>

          </header>

          <div
              className="workspace"
              style={{
                display:
                    appView === 'PATIENTS'
                        ? undefined
                        : 'none',
              }}
          >

            {/* PATIENT LIST */}

            <section className="patient-list-panel">

              <div
                  className="search-wrapper"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
              >

                <input
                    className="patient-search"
                    placeholder="Search"
                    aria-label="Search patients by name, date of birth or patient number"
                    title="Search by name, date of birth or patient number"
                    value={search}
                    onChange={(event) =>
                        setSearch(
                            event.target.value,
                        )
                    }
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                />

                <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      openCreatePatient
                    }
                    style={{
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                >
                  + New patient
                </button>

              </div>

              <div className="patient-list">

                {loadingPatients && (
                    <div
                        style={{
                          padding:
                              '16px',
                        }}
                    >
                      Loading patients...
                    </div>
                )}

                {patientError && (
                    <div
                        style={{
                          padding:
                              '16px',
                        }}
                    >
                      {patientError}
                    </div>
                )}

                {!loadingPatients &&
                    !patientError &&
                    filteredPatients.map(
                        (patient) => (

                            <button
                                key={
                                  patient.id
                                }
                                className={`patient-row ${
                                    selectedPatientId ===
                                    patient.id
                                        ? 'selected'
                                        : ''
                                }`}
                                onClick={() =>
                                    selectPatient(
                                        patient.id,
                                    )
                                }
                            >

                              <div className="patient-avatar">
                                {getInitials(
                                    patient,
                                )}
                              </div>

                              <div className="patient-row-details">

                                <strong>
                                  {
                                    patient.firstName
                                  }{' '}
                                  {
                                    patient.lastName
                                  }
                                </strong>

                                <span>
                                  {patient.dateOfBirth
                                      ? `DOB ${formatDateOfBirth(patient.dateOfBirth)} · `
                                      : ''}
                                  Patient #{patient.id}
                                </span>

                              </div>

                            </button>

                        ),
                    )}

                {!loadingPatients &&
                    !patientError &&
                    filteredPatients.length ===
                    0 && (

                        <div
                            style={{
                              padding:
                                  '16px',
                            }}
                        >
                          No patients found.
                        </div>

                    )}

              </div>

            </section>

            {/* PATIENT DETAILS */}

            <section className="patient-panel">

              {!selectedPatient ? (

                  <div>

                    <h2>
                      Select a patient
                    </h2>

                    <p>
                      Choose a patient to view
                      their communication history.
                    </p>

                  </div>

              ) : (

                  <>

                    {/* HEADER */}

                    <div className="patient-header">

                      <div>

                        <h2>
                          {
                            selectedPatient.firstName
                          }{' '}
                          {
                            selectedPatient.lastName
                          }
                        </h2>

                        <p>
                          {selectedPatient.dateOfBirth
                              ? `DOB ${formatDateOfBirth(selectedPatient.dateOfBirth)} · `
                              : 'DOB not recorded · '}
                          Patient #{selectedPatient.id}
                        </p>

                      </div>

                      <button
                          className="secondary-button"
                          onClick={
                            openPatientEditor
                          }
                      >
                        Edit patient
                      </button>

                    </div>

                    {patientSaveConfirmation && (
                        <div
                            className="patient-save-confirmation"
                            role="status"
                        >
                          {patientSaveConfirmation}
                        </div>
                    )}

                    {/* CONTACT DETAILS */}

                    <div
                        className="contact-details"
                        style={{
                          alignItems: 'flex-start',
                        }}
                    >

                      <div
                          style={{
                            minWidth: 0,
                          }}
                      >

                        <span className="detail-label">
                          Phone numbers
                        </span>

                        <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '7px',
                              marginTop: '5px',
                            }}
                        >

                          {selectedPatient.phoneNumbers.filter(
                              (phone) => phone.active,
                          ).length === 0 && (
                              <strong>
                                No phone number
                              </strong>
                          )}

                          {selectedPatient.phoneNumbers
                              .filter(
                                  (phone) => phone.active,
                              )
                              .map(
                                  (phone) => (

                                      <div
                                          key={phone.id}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '7px',
                                            minWidth: 0,
                                          }}
                                      >

                                        <strong
                                            style={{
                                              overflowWrap:
                                                  'anywhere',
                                            }}
                                        >
                                          {phone.number}
                                        </strong>

                                        {phone.primaryNumber && (
                                            <span
                                                style={{
                                                  padding:
                                                      '2px 7px',
                                                  borderRadius:
                                                      '999px',
                                                  background:
                                                      '#e8f1ff',
                                                  color:
                                                      '#3567a8',
                                                  fontSize:
                                                      '10px',
                                                  fontWeight: 700,
                                                }}
                                            >
                                              Primary
                                            </span>
                                        )}

                                      </div>

                                  ),
                              )}

                        </div>

                      </div>

                      <div
                          style={{
                            minWidth: 0,
                          }}
                      >

                        <span className="detail-label">
                          Email addresses
                        </span>

                        <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '7px',
                              marginTop: '5px',
                            }}
                        >

                          {loadingEmailAddresses && (
                              <strong>
                                Loading...
                              </strong>
                          )}

                          {!loadingEmailAddresses &&
                              emailAddressError && (
                                  <strong>
                                    Could not load email addresses
                                  </strong>
                              )}

                          {!loadingEmailAddresses &&
                              !emailAddressError &&
                              emailAddresses.filter(
                                  (address) => address.active,
                              ).length === 0 && (
                                  <strong>
                                    No email address
                                  </strong>
                              )}

                          {!loadingEmailAddresses &&
                              !emailAddressError &&
                              emailAddresses
                                  .filter(
                                      (address) =>
                                          address.active,
                                  )
                                  .map(
                                      (address) => (

                                          <div
                                              key={address.id}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                gap: '7px',
                                                minWidth: 0,
                                              }}
                                          >

                                            <strong
                                                style={{
                                                  overflowWrap:
                                                      'anywhere',
                                                }}
                                            >
                                              {address.address}
                                            </strong>

                                            {address.primaryAddress && (
                                                <span
                                                    style={{
                                                      padding:
                                                          '2px 7px',
                                                      borderRadius:
                                                          '999px',
                                                      background:
                                                          '#e8f1ff',
                                                      color:
                                                          '#3567a8',
                                                      fontSize:
                                                          '10px',
                                                      fontWeight:
                                                          700,
                                                    }}
                                                >
                                                  Primary
                                                </span>
                                            )}

                                          </div>

                                      ),
                                  )}

                        </div>

                      </div>

                    </div>

                    {/* ACTIONS */}

                    <div className="patient-actions">

                      <button
                          className="action-button primary-action"
                          onClick={
                            openEmailComposer
                          }
                      >
                        ✉ Email
                      </button>

                      <button
                          className="action-button"
                          onClick={
                            openNoteComposer
                          }
                      >
                        📝 Add note
                      </button>

                    </div>

                    {/* ACTIVITY */}

                    <div className="activity-section">

                      <div className="activity-heading">

                        <h3>
                          Activity
                        </h3>

                        <span>
                                            {
                                              visibleActivities.length
                                            }{' '}
                          {visibleActivities.length ===
                          1
                              ? 'event'
                              : 'events'}
                                        </span>

                      </div>

                      <div className="activity-filters">

                        {(
                            [
                              'ALL',
                              'CALL',
                              'EMAIL',
                              'NOTE',
                              'REMOVED',
                            ] as ActivityFilter[]
                        ).map(
                            (filter) => (

                                <button
                                    key={
                                      filter
                                    }
                                    className={`activity-filter-button ${
                                        activityFilter ===
                                        filter
                                            ? 'active'
                                            : ''
                                    }`}
                                    onClick={() =>
                                        selectActivityFilter(
                                            filter,
                                        )
                                    }
                                >
                                  {getFilterLabel(
                                      filter,
                                  )}
                                </button>

                            ),
                        )}

                      </div>

                      {loadingActivity && (
                          <div>
                            Loading activity...
                          </div>
                      )}

                      {activityError && (
                          <div>
                            {activityError}
                          </div>
                      )}

                      {activityActionError && (
                          <div className="activity-action-error">
                            {
                              activityActionError
                            }
                          </div>
                      )}

                      {!loadingActivity &&
                          !activityError &&
                          visibleActivities.length ===
                          0 && (

                              <div>
                                {activityFilter ===
                                'REMOVED'
                                    ? 'No removed activity.'
                                    : activityFilter ===
                                    'ALL'
                                        ? 'No activity yet.'
                                        : `No ${getFilterLabel(
                                            activityFilter,
                                        ).toLowerCase()} activity yet.`}
                              </div>

                          )}

                      {!loadingActivity &&
                          !activityError &&
                          visibleActivities.length >
                          0 && (

                              <div className="timeline">

                                {visibleActivities.map(
                                    (activity) => {

                                      const status =
                                          getActivityStatus(
                                              activity,
                                          )

                                      const key =
                                          getActivityKey(
                                              activity,
                                          )

                                      const menuOpen =
                                          openActivityMenuKey ===
                                          key

                                      return (

                                          <article
                                              className={`activity-card ${activity.type.toLowerCase()} ${
                                                  activity.type !== 'NOTE' &&
                                                  (activity.callDirection === 'OUTBOUND' ||
                                                      activity.emailDirection === 'OUTBOUND')
                                                      ? 'direction-outbound'
                                                      : activity.type !== 'NOTE'
                                                          ? 'direction-inbound'
                                                          : ''
                                              } ${
                                                  activity.removedAt
                                                      ? 'removed'
                                                      : ''
                                              }`}
                                              key={
                                                key
                                              }
                                          >

                                            <div className="activity-icon">
                                              {activityIcon(
                                                  activity.type,
                                              )}
                                            </div>

                                            <div className="activity-content">

                                              <div className="activity-top">

                                                <div>

                                                  <strong>
                                                    {getActivityTitle(
                                                        activity,
                                                    )}
                                                  </strong>

                                                  {activity.type !== 'NOTE' && (
                                                      <span className={`direction-badge ${
                                                        activity.callDirection === 'OUTBOUND' ||
                                                        activity.emailDirection === 'OUTBOUND'
                                                            ? 'outbound'
                                                            : 'inbound'
                                                      }`}>
                                                        {activity.callDirection === 'OUTBOUND' ||
                                                        activity.emailDirection === 'OUTBOUND'
                                                            ? 'Outgoing'
                                                            : 'Incoming'}
                                                      </span>
                                                  )}

                                                  {status && (

                                                      <span
                                                          className="status-badge"
                                                          style={
                                                            getStatusBadgeStyle(
                                                                status,
                                                            )
                                                          }
                                                      >

                                                                                {formatStatus(
                                                                                    status,
                                                                                )}

                                                                            </span>

                                                  )}

                                                  {activity.removedAt && (

                                                      <span className="removed-badge">
                                                                                Removed
                                                                            </span>

                                                  )}

                                                </div>

                                                <div className="activity-top-actions">

                                                  <time>
                                                    {formatActivityTime(
                                                        activity.occurredAt,
                                                    )}
                                                  </time>

                                                  {!activity.removedAt && (

                                                      <div className="activity-menu-wrapper">

                                                        <button
                                                            className="activity-menu-button"
                                                            aria-label="Activity actions"
                                                            onClick={() =>
                                                                setOpenActivityMenuKey(
                                                                    menuOpen
                                                                        ? null
                                                                        : key,
                                                                )
                                                            }
                                                        >
                                                          ⋯
                                                        </button>

                                                        {menuOpen && (

                                                            <div className="activity-menu">

                                                              {activity.type ===
                                                                  'NOTE' && (

                                                                      <button
                                                                          onClick={() =>
                                                                              openEditNoteComposer(
                                                                                  activity,
                                                                              )
                                                                          }
                                                                      >
                                                                        Edit note
                                                                      </button>

                                                                  )}

                                                              <button
                                                                  className="activity-menu-remove"
                                                                  onClick={() =>
                                                                      requestRemoveActivity(
                                                                          activity,
                                                                      )
                                                                  }
                                                              >
                                                                Remove from activity
                                                              </button>

                                                            </div>

                                                        )}

                                                      </div>

                                                  )}

                                                </div>

                                              </div>

                                              {activity.removedAt && (

                                                  <div className="removed-information">

                                                    Removed from activity{' '}
                                                    {formatActivityTime(
                                                        activity.removedAt,
                                                    )}

                                                    <button
                                                        className="restore-activity-button"
                                                        onClick={() =>
                                                            requestRestoreActivity(
                                                                activity,
                                                            )
                                                        }
                                                    >
                                                      Restore
                                                    </button>

                                                  </div>

                                              )}

                                              {activity.type ===
                                                  'CALL' && (

                                                  <>

                                                    {(activity.counterpartyNumber ||
                                                        activity.durationSeconds !==
                                                        null ||
                                                        activity.callDirection) && (

                                                        <div className="call-details">

                                                          <span>
                                                            {activity.callDirection === 'OUTBOUND'
                                                                ? 'To'
                                                                : 'From'}{' '}
                                                            {activity.counterpartyNumber ??
                                                                'Private / withheld number'}
                                                          </span>

                                                          {activity.durationSeconds !==
                                                              null && (

                                                              <span>
                                                                {formatCallDuration(
                                                                    activity.durationSeconds,
                                                                )}
                                                              </span>

                                                          )}

                                                        </div>

                                                    )}

                                                    {activity.followUpStatus &&
                                                        !activity.removedAt && (

                                                        <div
                                                            style={{
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              flexWrap: 'wrap',
                                                              gap: '8px',
                                                              marginTop: '12px',
                                                            }}
                                                        >

                                                          <span
                                                              style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                padding: '4px 8px',
                                                                borderRadius: '999px',
                                                                fontSize: '11px',
                                                                fontWeight: 700,
                                                                ...getFollowUpBadgeStyle(
                                                                    activity.followUpStatus,
                                                                ),
                                                              }}
                                                          >
                                                            Follow-up: {formatStatus(
                                                              activity.followUpStatus,
                                                          )}
                                                          </span>

                                                          {activity.followUpStatus ===
                                                              'NOT_REVIEWED' && (

                                                              <button
                                                                  type="button"
                                                                  className="secondary-button"
                                                                  onClick={() =>
                                                                      void handleUpdateCallFollowUp(
                                                                          activity,
                                                                          'FOLLOW_UP_REQUIRED',
                                                                      )
                                                                  }
                                                                  disabled={
                                                                    updatingCallFollowUpId ===
                                                                    activity.id
                                                                  }
                                                                  style={{
                                                                    padding:
                                                                        '6px 10px',
                                                                    fontSize:
                                                                        '11px',
                                                                  }}
                                                              >
                                                                Follow up
                                                              </button>

                                                          )}

                                                          {activity.followUpStatus ===
                                                              'FOLLOW_UP_REQUIRED' && (

                                                              <button
                                                                  type="button"
                                                                  className="secondary-button"
                                                                  onClick={() =>
                                                                      void handleUpdateCallFollowUp(
                                                                          activity,
                                                                          'NOT_REVIEWED',
                                                                      )
                                                                  }
                                                                  disabled={
                                                                    updatingCallFollowUpId ===
                                                                    activity.id
                                                                  }
                                                                  style={{
                                                                    padding:
                                                                        '6px 10px',
                                                                    fontSize:
                                                                        '11px',
                                                                  }}
                                                              >
                                                                Not reviewed
                                                              </button>

                                                          )}

                                                          {activity.followUpStatus ===
                                                              'RESOLVED' && (

                                                              <button
                                                                  type="button"
                                                                  className="secondary-button"
                                                                  onClick={() =>
                                                                      void handleUpdateCallFollowUp(
                                                                          activity,
                                                                          'FOLLOW_UP_REQUIRED',
                                                                      )
                                                                  }
                                                                  disabled={
                                                                    updatingCallFollowUpId ===
                                                                    activity.id
                                                                  }
                                                                  style={{
                                                                    padding:
                                                                        '6px 10px',
                                                                    fontSize:
                                                                        '11px',
                                                                  }}
                                                              >
                                                                Follow up
                                                              </button>

                                                          )}

                                                          {(activity.followUpStatus ===
                                                              'NOT_REVIEWED' ||
                                                              activity.followUpStatus ===
                                                                  'FOLLOW_UP_REQUIRED') && (

                                                              <button
                                                                  type="button"
                                                                  className="secondary-button"
                                                                  onClick={() =>
                                                                      void handleUpdateCallFollowUp(
                                                                          activity,
                                                                          'RESOLVED',
                                                                      )
                                                                  }
                                                                  disabled={
                                                                    updatingCallFollowUpId ===
                                                                    activity.id
                                                                  }
                                                                  style={{
                                                                    padding:
                                                                        '6px 10px',
                                                                    fontSize:
                                                                        '11px',
                                                                  }}
                                                              >
                                                                {updatingCallFollowUpId ===
                                                                activity.id
                                                                    ? 'Updating...'
                                                                    : 'Resolve'}
                                                              </button>

                                                          )}

                                                        </div>

                                                    )}

                                                    {activity.staffNote ? (

                                                        <div className="staff-note-block">

                                                          <div className="staff-note-heading">

                                                            <div className="staff-note-label">
                                                              <strong>
                                                                Staff note
                                                              </strong>

                                                              <span>
                                                                Practice staff only
                                                              </span>
                                                            </div>

                                                            {!activity.removedAt && (

                                                                <button
                                                                    className="staff-note-edit-button"
                                                                    onClick={() =>
                                                                        openCallNoteComposer(
                                                                            activity,
                                                                        )
                                                                    }
                                                                >
                                                                  Edit
                                                                </button>

                                                            )}

                                                          </div>

                                                          <p className="activity-text staff-note-text">
                                                            {
                                                              activity.staffNote
                                                            }
                                                          </p>

                                                        </div>

                                                    ) : (

                                                        !activity.removedAt && (

                                                            <button
                                                                className="add-staff-note-button"
                                                                onClick={() =>
                                                                    openCallNoteComposer(
                                                                        activity,
                                                                    )
                                                                }
                                                            >
                                                              + Add staff note
                                                            </button>

                                                        )

                                                    )}

                                                  </>

                                              )}

                                              {activity.type ===
                                                  'NOTE' &&
                                                  activity.text && (

                                                  <p className="activity-text">
                                                    {
                                                      activity.text
                                                    }
                                                  </p>

                                              )}

                                              {activity.type ===
                                                  'EMAIL' && (

                                                  <>

                                                    {activity.text && (

                                                        <p className="activity-text">
                                                          {
                                                            activity.text
                                                          }
                                                        </p>

                                                    )}

                                                    {activity.emailDirection ===
                                                        'INBOUND' &&
                                                        !activity.removedAt && (

                                                        <div
                                                            style={{
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              flexWrap: 'wrap',
                                                              gap: '8px',
                                                              marginTop: '12px',
                                                            }}
                                                        >

                                                          <button
                                                              type="button"
                                                              className="secondary-button"
                                                              onClick={() =>
                                                                  openReplyComposer(
                                                                      activity,
                                                                  )
                                                              }
                                                              style={{
                                                                padding:
                                                                    '6px 10px',
                                                                fontSize:
                                                                    '11px',
                                                              }}
                                                          >
                                                            Reply
                                                          </button>

                                                          {activity.emailStatus ===
                                                              'UNREAD' && (

                                                              <button
                                                                  type="button"
                                                                  className="secondary-button"
                                                                  onClick={() =>
                                                                      void handleUpdateEmailStatus(
                                                                          activity,
                                                                          'AWAITING_REPLY',
                                                                      )
                                                                  }
                                                                  disabled={
                                                                    updatingEmailStatusId ===
                                                                    activity.id
                                                                  }
                                                                  style={{
                                                                    padding:
                                                                        '6px 10px',
                                                                    fontSize:
                                                                        '11px',
                                                                  }}
                                                              >
                                                                Needs reply
                                                              </button>

                                                          )}

                                                          {activity.emailStatus ===
                                                              'AWAITING_REPLY' && (

                                                              <button
                                                                  type="button"
                                                                  className="secondary-button"
                                                                  onClick={() =>
                                                                      void handleUpdateEmailStatus(
                                                                          activity,
                                                                          'UNREAD',
                                                                      )
                                                                  }
                                                                  disabled={
                                                                    updatingEmailStatusId ===
                                                                    activity.id
                                                                  }
                                                                  style={{
                                                                    padding:
                                                                        '6px 10px',
                                                                    fontSize:
                                                                        '11px',
                                                                  }}
                                                              >
                                                                Mark unread
                                                              </button>

                                                          )}

                                                          {activity.emailStatus ===
                                                              'RESOLVED' && (

                                                              <button
                                                                  type="button"
                                                                  className="secondary-button"
                                                                  onClick={() =>
                                                                      void handleUpdateEmailStatus(
                                                                          activity,
                                                                          'AWAITING_REPLY',
                                                                      )
                                                                  }
                                                                  disabled={
                                                                    updatingEmailStatusId ===
                                                                    activity.id
                                                                  }
                                                                  style={{
                                                                    padding:
                                                                        '6px 10px',
                                                                    fontSize:
                                                                        '11px',
                                                                  }}
                                                              >
                                                                Needs reply
                                                              </button>

                                                          )}

                                                          {(activity.emailStatus ===
                                                              'UNREAD' ||
                                                              activity.emailStatus ===
                                                                  'AWAITING_REPLY') && (

                                                              <button
                                                                  type="button"
                                                                  className="secondary-button"
                                                                  onClick={() =>
                                                                      void handleUpdateEmailStatus(
                                                                          activity,
                                                                          'RESOLVED',
                                                                      )
                                                                  }
                                                                  disabled={
                                                                    updatingEmailStatusId ===
                                                                    activity.id
                                                                  }
                                                                  style={{
                                                                    padding:
                                                                        '6px 10px',
                                                                    fontSize:
                                                                        '11px',
                                                                  }}
                                                              >
                                                                {updatingEmailStatusId ===
                                                                activity.id
                                                                    ? 'Updating...'
                                                                    : 'Resolve'}
                                                              </button>

                                                          )}

                                                        </div>

                                                    )}

                                                    {activity.staffNote ? (

                                                        <div className="staff-note-block">

                                                          <div className="staff-note-heading">

                                                            <div className="staff-note-label">
                                                              <strong>
                                                                Staff note
                                                              </strong>

                                                              <span>
                                                                Practice staff only
                                                              </span>
                                                            </div>

                                                            {!activity.removedAt && (

                                                                <button
                                                                    className="staff-note-edit-button"
                                                                    onClick={() =>
                                                                        openEmailNoteComposer(
                                                                            activity,
                                                                        )
                                                                    }
                                                                >
                                                                  Edit
                                                                </button>

                                                            )}

                                                          </div>

                                                          <p className="activity-text staff-note-text">
                                                            {
                                                              activity.staffNote
                                                            }
                                                          </p>

                                                        </div>

                                                    ) : (

                                                        !activity.removedAt && (

                                                            <button
                                                                className="add-staff-note-button"
                                                                onClick={() =>
                                                                    openEmailNoteComposer(
                                                                        activity,
                                                                    )
                                                                }
                                                            >
                                                              + Add staff note
                                                            </button>

                                                        )

                                                    )}

                                                  </>

                                              )}

                                            </div>

                                          </article>

                                      )
                                    },
                                )}

                              </div>

                          )}

                    </div>

                    {/* FLOATING COMPOSER */}

                    {composerMode && (

                        <div
                            className={`floating-composer ${
                                composerMode ===
                                'CALL_NOTE' ||
                                composerMode ===
                                'EMAIL_NOTE'
                                    ? 'staff-note-composer'
                                    : ''
                            }`}
                        >

                          <div
                              className={`floating-composer-header ${
                                  composerMode ===
                                  'CALL_NOTE' ||
                                  composerMode ===
                                  'EMAIL_NOTE'
                                      ? 'staff-note-composer-header'
                                      : ''
                              }`}
                          >

                            <strong>

                              {composerMode ===
                              'EMAIL'
                                  ? replyToEmailId !== null
                                      ? 'Reply'
                                      : 'New email'
                                  : composerMode ===
                                        'CALL_NOTE' ||
                                    composerMode ===
                                        'EMAIL_NOTE'
                                      ? 'Staff note'
                                      : editingNoteId !==
                                        null
                                          ? 'Edit note'
                                          : 'Add note'}

                            </strong>

                            <button
                                className="composer-close-button"
                                onClick={
                                  closeComposer
                                }
                                disabled={
                                    sendingEmail ||
                                    savingNote
                                }
                            >
                              ×
                            </button>

                          </div>

                          {composerMode ===
                              'EMAIL' && (

                                  <>

                                    <div
                                        className="composer-recipient"
                                        style={{
                                          display: 'block',
                                          paddingTop: '10px',
                                          paddingBottom: '10px',
                                        }}
                                    >

                                      <span
                                          style={{
                                            display: 'block',
                                            marginBottom: '8px',
                                          }}
                                      >
                                        To
                                      </span>

                                      {emailAddresses.length === 0 ? (

                                          <strong>
                                            No active email address
                                          </strong>

                                      ) : (

                                          <div
                                              style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '7px',
                                              }}
                                          >

                                            {emailAddresses.map(
                                                (address) => (

                                                    <label
                                                        key={address.id}
                                                        style={{
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          gap: '8px',
                                                          cursor: sendingEmail
                                                              ? 'default'
                                                              : 'pointer',
                                                        }}
                                                    >
                                                      <input
                                                          type="radio"
                                                          name="email-recipient"
                                                          checked={
                                                            !sendToAllEmails &&
                                                            selectedEmailAddressId ===
                                                            address.id
                                                          }
                                                          disabled={
                                                            sendingEmail
                                                          }
                                                          onChange={() => {
                                                            setSendToAllEmails(
                                                                false,
                                                            )
                                                            setSelectedEmailAddressId(
                                                                address.id,
                                                            )
                                                            setComposerError(
                                                                null,
                                                            )
                                                          }}
                                                      />

                                                      <span
                                                          style={{
                                                            overflowWrap:
                                                                'anywhere',
                                                          }}
                                                      >
                                                        {address.address}
                                                      </span>

                                                      {address.primaryAddress && (
                                                          <span
                                                              style={{
                                                                padding:
                                                                    '2px 7px',
                                                                borderRadius:
                                                                    '999px',
                                                                background:
                                                                    '#e8f1ff',
                                                                color:
                                                                    '#3567a8',
                                                                fontSize:
                                                                    '10px',
                                                                fontWeight:
                                                                    700,
                                                              }}
                                                          >
                                                            Primary
                                                          </span>
                                                      )}
                                                    </label>

                                                ),
                                            )}

                                            {emailAddresses.length > 1 &&
                                                replyToEmailId === null && (

                                                <label
                                                    style={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '8px',
                                                      marginTop: '3px',
                                                      cursor: sendingEmail
                                                          ? 'default'
                                                          : 'pointer',
                                                    }}
                                                >
                                                  <input
                                                      type="radio"
                                                      name="email-recipient"
                                                      checked={
                                                        sendToAllEmails
                                                      }
                                                      disabled={
                                                        sendingEmail
                                                      }
                                                      onChange={() => {
                                                        setSendToAllEmails(
                                                            true,
                                                        )
                                                        setSelectedEmailAddressId(
                                                            null,
                                                        )
                                                        setComposerError(
                                                            null,
                                                        )
                                                      }}
                                                  />

                                                  <strong>
                                                    Send to all emails
                                                  </strong>
                                                </label>

                                            )}

                                          </div>

                                      )}

                                    </div>

                                    <input
                                        className="floating-subject-input"
                                        placeholder="Subject"
                                        value={
                                          emailSubject
                                        }
                                        disabled={
                                          sendingEmail
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            setEmailSubject(
                                                event
                                                    .target
                                                    .value,
                                            )
                                        }
                                    />

                                  </>

                              )}

                          {(composerMode ===
                              'CALL_NOTE' ||
                              composerMode ===
                              'EMAIL_NOTE') && (

                              <div className="staff-note-composer-context">

                                <strong>
                                  Practice staff only
                                </strong>

                                <span>
                                  {composerMode ===
                                  'CALL_NOTE'
                                      ? 'This note stays with the call and is not sent to the patient.'
                                      : 'This note stays with the email and is not sent to the patient.'}
                                </span>

                              </div>

                          )}

                          <textarea
                              className="floating-message-input"
                              placeholder={
                                composerMode ===
                                'EMAIL'
                                    ? 'Write an email...'
                                    : composerMode ===
                                      'CALL_NOTE'
                                        ? 'Write a staff note about this call...'
                                        : composerMode ===
                                          'EMAIL_NOTE'
                                            ? 'Write a staff note about this email...'
                                            : 'Write a note...'
                              }
                              value={
                                composerText
                              }
                              disabled={
                                  sendingEmail ||
                                  savingNote
                              }
                              onChange={(
                                  event,
                              ) =>
                                  setComposerText(
                                      event
                                          .target
                                          .value,
                                  )
                              }
                          />

                          {composerError && (

                              <div
                                  style={{
                                    padding:
                                        '10px 16px',
                                    background:
                                        '#fff1f1',
                                    color:
                                        '#a63d3d',
                                    fontSize:
                                        '13px',
                                    borderTop:
                                        '1px solid #f3d4d4',
                                  }}
                              >
                                {
                                  composerError
                                }
                              </div>

                          )}

                          <div className="floating-composer-footer">

                            {composerMode ===
                            'EMAIL' ? (

                                <button
                                    className="primary-button"
                                    onClick={
                                      handleSendEmail
                                    }
                                    disabled={
                                        sendingEmail ||
                                        emailSent ||
                                        emailAddresses.length ===
                                        0 ||
                                        (
                                            !sendToAllEmails &&
                                            selectedEmailAddressId ===
                                            null
                                        )
                                    }
                                >

                                  {emailSent
                                      ? 'Sent ✓'
                                      : sendingEmail
                                          ? 'Sending...'
                                          : sendToAllEmails
                                              ? 'Send to all emails'
                                              : 'Send'}

                                </button>

                            ) : composerMode ===
                              'CALL_NOTE' ? (

                                <button
                                    className="staff-note-save-button"
                                    onClick={
                                      handleSaveCallNote
                                    }
                                    disabled={
                                        savingNote ||
                                        noteSaved ||
                                        !composerText.trim()
                                    }
                                >

                                  {noteSaved
                                      ? 'Saved ✓'
                                      : savingNote
                                          ? 'Saving...'
                                          : 'Save note'}

                                </button>

                            ) : composerMode ===
                              'EMAIL_NOTE' ? (

                                <button
                                    className="staff-note-save-button"
                                    onClick={
                                      handleSaveEmailNote
                                    }
                                    disabled={
                                        savingNote ||
                                        noteSaved ||
                                        !composerText.trim()
                                    }
                                >

                                  {noteSaved
                                      ? 'Saved ✓'
                                      : savingNote
                                          ? 'Saving...'
                                          : 'Save note'}

                                </button>

                            ) : (

                                <button
                                    className="primary-button"
                                    onClick={
                                      handleSaveNote
                                    }
                                    disabled={
                                        savingNote ||
                                        noteSaved ||
                                        !composerText.trim()
                                    }
                                >

                                  {noteSaved
                                      ? 'Saved ✓'
                                      : savingNote
                                          ? editingNoteId !==
                                          null
                                              ? 'Saving changes...'
                                              : 'Saving...'
                                          : editingNoteId !==
                                          null
                                              ? 'Save changes'
                                              : 'Save note'}

                                </button>

                            )}

                          </div>

                        </div>

                    )}

                    {/* EDIT PATIENT */}

                    {editingPatient && (

                        <div className="confirmation-backdrop">

                          <div
                              className="confirmation-dialog"
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby="edit-patient-title"
                              style={{
                                width: 'min(620px, calc(100vw - 32px))',
                                maxWidth: '620px',
                                maxHeight: 'calc(100vh - 48px)',
                                overflowY: 'auto',
                              }}
                          >

                            <h3 id="edit-patient-title">
                              Edit patient
                            </h3>

                            <p>
                              Update the patient's details.
                            </p>

                            <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns:
                                      'repeat(2, minmax(0, 1fr))',
                                  gap: '12px',
                                  marginTop: '16px',
                                }}
                            >

                              <label
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: '#52616d',
                                  }}
                              >
                                First name

                                <input
                                    className="floating-subject-input"
                                    value={
                                      editFirstName
                                    }
                                    onChange={(
                                        event,
                                    ) => {
                                      setEditFirstName(
                                          event.target.value,
                                      )
                                      setPatientSaveConfirmation(
                                          null,
                                      )
                                    }}
                                    disabled={
                                      savingPatient ||
                                      managingPhone ||
                                      managingEmail
                                    }
                                    maxLength={100}
                                    autoFocus
                                />
                              </label>

                              <label
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: '#52616d',
                                  }}
                              >
                                Last name

                                <input
                                    className="floating-subject-input"
                                    value={
                                      editLastName
                                    }
                                    onChange={(
                                        event,
                                    ) => {
                                      setEditLastName(
                                          event.target.value,
                                      )
                                      setPatientSaveConfirmation(
                                          null,
                                      )
                                    }}
                                    disabled={
                                      savingPatient ||
                                      managingPhone ||
                                      managingEmail
                                    }
                                    maxLength={100}
                                />
                              </label>

                            </div>

                            <label
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                  marginTop: '14px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#52616d',
                                }}
                            >
                              Date of birth

                              <input
                                  type="text"
                                  className="floating-subject-input"
                                  placeholder="DD/MM/YYYY"
                                  autoComplete="bday"
                                  maxLength={10}
                                  value={editDateOfBirth}
                                  onChange={(event) => {
                                    setEditDateOfBirth(
                                        event.target.value,
                                    )
                                    setPatientSaveConfirmation(
                                        null,
                                    )
                                  }}
                                  disabled={
                                    savingPatient ||
                                    managingPhone ||
                                    managingEmail
                                  }
                              />
                            </label>

                            <div
                                style={{
                                  marginTop: '20px',
                                  paddingTop: '18px',
                                  borderTop:
                                      '1px solid #e5e9ec',
                                }}
                            >

                              <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                  }}
                              >
                                <strong
                                    style={{
                                      fontSize: '14px',
                                      color: '#33414b',
                                    }}
                                >
                                  Phone numbers
                                </strong>

                                <span
                                    style={{
                                      fontSize: '11px',
                                      color: '#87939c',
                                    }}
                                >
                                  Removals apply when you save changes
                                </span>
                              </div>

                              <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    marginTop: '10px',
                                  }}
                              >

                                {selectedPatient.phoneNumbers.filter(
                                    (phone) =>
                                        !pendingPhoneRemovalIds.includes(
                                            phone.id,
                                        ),
                                ).length === 0 && (
                                    <div
                                        style={{
                                          padding:
                                              '10px 12px',
                                          border:
                                              '1px solid #e5e9ec',
                                          borderRadius:
                                              '8px',
                                          color:
                                              '#71808a',
                                          fontSize:
                                              '13px',
                                        }}
                                    >
                                      No active phone numbers.
                                    </div>
                                )}

                                {selectedPatient.phoneNumbers
                                    .filter(
                                        (phone) =>
                                            !pendingPhoneRemovalIds.includes(
                                                phone.id,
                                            ),
                                    )
                                    .map(
                                    (phone) => (

                                        <div
                                            key={phone.id}
                                            style={{
                                              display:
                                                  'flex',
                                              alignItems:
                                                  'center',
                                              justifyContent:
                                                  'space-between',
                                              gap: '12px',
                                              padding:
                                                  '10px 12px',
                                              border:
                                                  '1px solid #e5e9ec',
                                              borderRadius:
                                                  '8px',
                                              background:
                                                  '#fafbfc',
                                            }}
                                        >

                                          <div
                                              style={{
                                                minWidth: 0,
                                                display:
                                                    'flex',
                                                alignItems:
                                                    'center',
                                                flexWrap:
                                                    'wrap',
                                                gap: '8px',
                                              }}
                                          >
                                            <strong
                                                style={{
                                                  fontSize:
                                                      '13px',
                                                  color:
                                                      '#33414b',
                                                  overflowWrap:
                                                      'anywhere',
                                                }}
                                            >
                                              {phone.number}
                                            </strong>

                                            {phone.primaryNumber && (
                                                <span
                                                    style={{
                                                      padding:
                                                          '2px 7px',
                                                      borderRadius:
                                                          '999px',
                                                      background:
                                                          '#e8f1ff',
                                                      color:
                                                          '#3567a8',
                                                      fontSize:
                                                          '10px',
                                                      fontWeight:
                                                          700,
                                                    }}
                                                >
                                                  Primary
                                                </span>
                                            )}
                                          </div>

                                          <div
                                              style={{
                                                flexShrink:
                                                    0,
                                                display:
                                                    'flex',
                                                alignItems:
                                                    'center',
                                                gap: '8px',
                                              }}
                                          >

                                            {!phone.primaryNumber && (
                                                <button
                                                    type="button"
                                                    className="secondary-button"
                                                    onClick={() =>
                                                        void handleSetPrimaryPhoneNumber(
                                                            phone.id,
                                                        )
                                                    }
                                                    disabled={
                                                      managingPhone ||
                                                      managingEmail ||
                                                      savingPatient
                                                    }
                                                    style={{
                                                      padding:
                                                          '6px 9px',
                                                      fontSize:
                                                          '11px',
                                                    }}
                                                >
                                                  Make primary
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleDeactivatePhoneNumber(
                                                        phone.id,
                                                    )
                                                }
                                                disabled={
                                                  managingPhone ||
                                                  managingEmail ||
                                                  savingPatient
                                                }
                                                style={{
                                                  border: 0,
                                                  background:
                                                      'transparent',
                                                  color:
                                                      '#a14b4b',
                                                  fontSize:
                                                      '11px',
                                                  fontWeight:
                                                      700,
                                                  cursor:
                                                      managingPhone ||
                                                      managingEmail ||
                                                      savingPatient
                                                          ? 'default'
                                                          : 'pointer',
                                                  opacity:
                                                      managingPhone ||
                                                      managingEmail ||
                                                      savingPatient
                                                          ? 0.55
                                                          : 1,
                                                }}
                                            >
                                              Remove from contacts
                                            </button>

                                          </div>

                                        </div>

                                    ),
                                )}

                              </div>

                              <div
                                  style={{
                                    display: 'flex',
                                    gap: '8px',
                                    marginTop: '10px',
                                  }}
                              >

                                <input
                                    className="floating-subject-input"
                                    placeholder="+353..."
                                    value={
                                      newPhoneNumber
                                    }
                                    onChange={(
                                        event,
                                    ) => {
                                      setNewPhoneNumber(
                                          event.target.value,
                                      )
                                      setPatientSaveConfirmation(
                                          null,
                                      )
                                    }}
                                    disabled={
                                      managingPhone ||
                                      managingEmail ||
                                      savingPatient
                                    }
                                    maxLength={32}
                                    onKeyDown={(
                                        event,
                                    ) => {
                                      if (
                                          event.key ===
                                          'Enter'
                                      ) {
                                        event.preventDefault()
                                        void handleAddPhoneNumber()
                                      }
                                    }}
                                    style={{
                                      flex: 1,
                                    }}
                                />

                                <button
                                    type="button"
                                    className="primary-button"
                                    onClick={() =>
                                        void handleAddPhoneNumber()
                                    }
                                    disabled={
                                      managingPhone ||
                                      managingEmail ||
                                      savingPatient ||
                                      !newPhoneNumber.trim()
                                    }
                                    style={{
                                      flexShrink: 0,
                                    }}
                                >
                                  {managingPhone
                                      ? 'Saving...'
                                      : 'Add phone'}
                                </button>

                              </div>

                            </div>

                            <div
                                style={{
                                  marginTop: '20px',
                                  paddingTop: '18px',
                                  borderTop:
                                      '1px solid #e5e9ec',
                                }}
                            >

                              <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                  }}
                              >
                                <strong
                                    style={{
                                      fontSize: '14px',
                                      color: '#33414b',
                                    }}
                                >
                                  Email addresses
                                </strong>

                                <span
                                    style={{
                                      fontSize: '11px',
                                      color: '#87939c',
                                    }}
                                >
                                  Removals apply when you save changes
                                </span>
                              </div>

                              <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    marginTop: '10px',
                                  }}
                              >

                                {loadingEmailAddresses && (
                                    <div
                                        style={{
                                          padding:
                                              '10px 12px',
                                          border:
                                              '1px solid #e5e9ec',
                                          borderRadius:
                                              '8px',
                                          color:
                                              '#71808a',
                                          fontSize:
                                              '13px',
                                        }}
                                    >
                                      Loading email addresses...
                                    </div>
                                )}

                                {!loadingEmailAddresses &&
                                    emailAddresses.filter(
                                        (emailAddress) =>
                                            !pendingEmailRemovalIds.includes(
                                                emailAddress.id,
                                            ),
                                    ).length === 0 && (
                                        <div
                                            style={{
                                              padding:
                                                  '10px 12px',
                                              border:
                                                  '1px solid #e5e9ec',
                                              borderRadius:
                                                  '8px',
                                              color:
                                                  '#71808a',
                                              fontSize:
                                                  '13px',
                                            }}
                                        >
                                          No active email addresses.
                                        </div>
                                    )}

                                {!loadingEmailAddresses &&
                                    emailAddresses
                                        .filter(
                                            (emailAddress) =>
                                                !pendingEmailRemovalIds.includes(
                                                    emailAddress.id,
                                                ),
                                        )
                                        .map(
                                        (emailAddress) => (

                                            <div
                                                key={
                                                  emailAddress.id
                                                }
                                                style={{
                                                  display:
                                                      'flex',
                                                  alignItems:
                                                      'center',
                                                  justifyContent:
                                                      'space-between',
                                                  gap: '12px',
                                                  padding:
                                                      '10px 12px',
                                                  border:
                                                      '1px solid #e5e9ec',
                                                  borderRadius:
                                                      '8px',
                                                  background:
                                                      '#fafbfc',
                                                }}
                                            >

                                              <div
                                                  style={{
                                                    minWidth: 0,
                                                    display:
                                                        'flex',
                                                    alignItems:
                                                        'center',
                                                    flexWrap:
                                                        'wrap',
                                                    gap: '8px',
                                                  }}
                                              >
                                                <strong
                                                    style={{
                                                      fontSize:
                                                          '13px',
                                                      color:
                                                          '#33414b',
                                                      overflowWrap:
                                                          'anywhere',
                                                    }}
                                                >
                                                  {
                                                    emailAddress.address
                                                  }
                                                </strong>

                                                {emailAddress.primaryAddress && (
                                                    <span
                                                        style={{
                                                          padding:
                                                              '2px 7px',
                                                          borderRadius:
                                                              '999px',
                                                          background:
                                                              '#e8f1ff',
                                                          color:
                                                              '#3567a8',
                                                          fontSize:
                                                              '10px',
                                                          fontWeight:
                                                              700,
                                                        }}
                                                    >
                                                      Primary
                                                    </span>
                                                )}
                                              </div>

                                              <div
                                                  style={{
                                                    flexShrink:
                                                        0,
                                                    display:
                                                        'flex',
                                                    alignItems:
                                                        'center',
                                                    gap: '8px',
                                                  }}
                                              >

                                                {!emailAddress.primaryAddress && (
                                                    <button
                                                        type="button"
                                                        className="secondary-button"
                                                        onClick={() =>
                                                            void handleSetPrimaryEmailAddress(
                                                                emailAddress.id,
                                                            )
                                                        }
                                                        disabled={
                                                          managingEmail ||
                                                          managingPhone ||
                                                          savingPatient
                                                        }
                                                        style={{
                                                          padding:
                                                              '6px 9px',
                                                          fontSize:
                                                              '11px',
                                                        }}
                                                    >
                                                      Make primary
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void handleDeactivateEmailAddress(
                                                            emailAddress.id,
                                                        )
                                                    }
                                                    disabled={
                                                      managingEmail ||
                                                      managingPhone ||
                                                      savingPatient
                                                    }
                                                    style={{
                                                      border: 0,
                                                      background:
                                                          'transparent',
                                                      color:
                                                          '#a14b4b',
                                                      fontSize:
                                                          '11px',
                                                      fontWeight:
                                                          700,
                                                      cursor:
                                                          managingEmail ||
                                                          managingPhone ||
                                                          savingPatient
                                                              ? 'default'
                                                              : 'pointer',
                                                      opacity:
                                                          managingEmail ||
                                                          managingPhone ||
                                                          savingPatient
                                                              ? 0.55
                                                              : 1,
                                                    }}
                                                >
                                                  Remove from contacts
                                                </button>

                                              </div>

                                            </div>

                                        ),
                                    )}

                              </div>

                              <div
                                  style={{
                                    display: 'flex',
                                    gap: '8px',
                                    marginTop: '10px',
                                  }}
                              >

                                <input
                                    type="email"
                                    className="floating-subject-input"
                                    placeholder="patient@example.com"
                                    value={
                                      newEmailAddress
                                    }
                                    onChange={(
                                        event,
                                    ) => {
                                      setNewEmailAddress(
                                          event.target.value,
                                      )
                                      setPatientSaveConfirmation(
                                          null,
                                      )
                                    }}
                                    disabled={
                                      managingEmail ||
                                      managingPhone ||
                                      savingPatient
                                    }
                                    maxLength={320}
                                    onKeyDown={(
                                        event,
                                    ) => {
                                      if (
                                          event.key ===
                                          'Enter'
                                      ) {
                                        event.preventDefault()
                                        void handleAddEmailAddress()
                                      }
                                    }}
                                    style={{
                                      flex: 1,
                                    }}
                                />

                                <button
                                    type="button"
                                    className="primary-button"
                                    onClick={() =>
                                        void handleAddEmailAddress()
                                    }
                                    disabled={
                                      managingEmail ||
                                      managingPhone ||
                                      savingPatient ||
                                      !newEmailAddress.trim()
                                    }
                                    style={{
                                      flexShrink: 0,
                                    }}
                                >
                                  {managingEmail
                                      ? 'Saving...'
                                      : 'Add email'}
                                </button>

                              </div>

                            </div>

                            {patientSaveConfirmation && (

                                <div
                                    className="patient-save-confirmation"
                                    role="status"
                                    style={{
                                      marginTop: '14px',
                                    }}
                                >
                                  {patientSaveConfirmation}
                                </div>

                            )}

                            {patientEditError && (

                                <div
                                    style={{
                                      marginTop: '14px',
                                      padding: '10px 12px',
                                      borderRadius: '8px',
                                      background: '#fff1f1',
                                      color: '#a63d3d',
                                      fontSize: '13px',
                                    }}
                                >
                                  {patientEditError}
                                </div>

                            )}

                            <div className="confirmation-actions">

                              <button
                                  className="secondary-button"
                                  onClick={
                                    closePatientEditor
                                  }
                                  disabled={
                                    savingPatient ||
                                    managingPhone ||
                                    managingEmail
                                  }
                              >
                                Cancel
                              </button>

                              <button
                                  className="primary-button"
                                  onClick={() =>
                                      void handleSavePatient()
                                  }
                                  disabled={
                                    savingPatient ||
                                    managingPhone ||
                                    managingEmail ||
                                    !editFirstName.trim() ||
                                    !editLastName.trim()
                                  }
                              >
                                {savingPatient
                                    ? 'Saving...'
                                    : 'Save changes'}
                              </button>

                            </div>

                          </div>

                        </div>

                    )}

                    {/* REMOVE / RESTORE CONFIRMATION */}

                    {pendingActivityAction && (

                        <div className="confirmation-backdrop">

                          <div
                              className="confirmation-dialog"
                              role="dialog"
                              aria-modal="true"
                          >

                            <h3>
                              {pendingActivityAction.action ===
                              'REMOVE'
                                  ? 'Remove from activity?'
                                  : 'Restore activity?'}
                            </h3>

                            <p>

                              {pendingActivityAction.action ===
                              'REMOVE'
                                  ? 'This item will disappear from the normal activity feed, but it will not be deleted. You can restore it later from Removed.'
                                  : 'This item will return to the normal patient activity feed.'}

                            </p>

                            <div className="confirmation-actions">

                              <button
                                  className="secondary-button"
                                  onClick={
                                    cancelActivityAction
                                  }
                                  disabled={
                                    activityActionRunning
                                  }
                              >
                                Cancel
                              </button>

                              <button
                                  className={
                                    pendingActivityAction.action ===
                                    'REMOVE'
                                        ? 'danger-button'
                                        : 'primary-button'
                                  }
                                  onClick={
                                    confirmActivityAction
                                  }
                                  disabled={
                                    activityActionRunning
                                  }
                              >

                                {activityActionRunning
                                    ? pendingActivityAction.action ===
                                    'REMOVE'
                                        ? 'Removing...'
                                        : 'Restoring...'
                                    : pendingActivityAction.action ===
                                    'REMOVE'
                                        ? 'Remove from activity'
                                        : 'Restore'}

                              </button>

                            </div>

                          </div>

                        </div>

                    )}

                  </>

              )}

            </section>

          </div>

          {/* INBOX */}

          {appView === 'INBOX' && (
              <div
                  style={{
                    padding: '28px 32px 40px',
                    overflowY: 'auto',
                    flex: 1,
                  }}
              >

                <div
                    style={{
                      maxWidth: '980px',
                      margin: '0 auto',
                    }}
                >

                  <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '16px',
                        marginBottom: '18px',
                      }}
                  >

                    <div>
                      <h2
                          style={{
                            margin: 0,
                            fontSize: '22px',
                          }}
                      >
                        Inbox
                      </h2>

                      <p
                          style={{
                            margin: '6px 0 0',
                            color: '#78858e',
                            fontSize: '13px',
                          }}
                      >
                        Review communication that needs attention or could not be matched to a patient.
                      </p>
                    </div>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                            void Promise.all([
                              refreshInbox(),
                              refreshUnmatched(),
                            ])
                        }
                        disabled={
                          loadingInbox ||
                          loadingUnmatched
                        }
                    >
                      {loadingInbox ||
                      loadingUnmatched
                          ? 'Refreshing...'
                          : 'Refresh'}
                    </button>

                  </div>

                  <div className="inbox-tab-groups">

                    <div className="inbox-tab-group">
                      <span className="inbox-tab-group-label">
                        Work queue
                      </span>

                      <div className="activity-filters inbox-tab-buttons">
                        <button
                            type="button"
                            className={`activity-filter-button ${
                                inboxTab ===
                                'ATTENTION'
                                    ? 'active'
                                    : ''
                            }`}
                            onClick={() =>
                                setInboxTab(
                                    'ATTENTION',
                                )
                            }
                        >
                          Needs attention
                          {inboxItems.length >
                              0 &&
                              ` (${inboxItems.length})`}
                        </button>

                        <button
                            type="button"
                            className={`activity-filter-button ${
                                inboxTab ===
                                'UNMATCHED'
                                    ? 'active'
                                    : ''
                            }`}
                            onClick={() => {
                              setInboxTab(
                                  'UNMATCHED',
                              )
                              void refreshUnmatched()
                            }}
                        >
                          Unmatched
                          {unmatchedCommunications.length >
                              0 &&
                              ` (${unmatchedCommunications.length})`}
                        </button>
                      </div>
                    </div>

                    <div className="inbox-tab-group">
                      <span className="inbox-tab-group-label">
                        Today
                      </span>

                      <div className="activity-filters inbox-tab-buttons">
                        <button
                            type="button"
                            className={`activity-filter-button ${
                                inboxTab ===
                                'DISMISSED'
                                    ? 'active'
                                    : ''
                            }`}
                            onClick={() => {
                              setInboxTab(
                                  'DISMISSED',
                              )
                              void refreshUnmatched()
                            }}
                        >
                          Dismissed
                        </button>

                        <button
                            type="button"
                            className={`activity-filter-button ${
                                inboxTab ===
                                'RESOLVED'
                                    ? 'active'
                                    : ''
                            }`}
                            onClick={() => {
                              setInboxTab(
                                  'RESOLVED',
                              )
                              void refreshUnmatched()
                            }}
                        >
                          Resolved
                        </button>

                        <button
                            type="button"
                            className={`activity-filter-button ${
                                inboxTab ===
                                'ALL'
                                    ? 'active'
                                    : ''
                            }`}
                            onClick={() => {
                              setInboxTab('ALL')
                              void refreshUnmatched()
                            }}
                        >
                          All
                        </button>
                      </div>
                    </div>

                  </div>

                  {inboxTab ===
                      'ATTENTION' && (
                      <>

                        {inboxError && (
                            <div
                                className="activity-action-error"
                                style={{
                                  marginBottom:
                                      '16px',
                                }}
                            >
                              {inboxError}
                            </div>
                        )}

                        {loadingInbox &&
                            inboxItems.length ===
                            0 && (
                                <div>
                                  Loading inbox...
                                </div>
                            )}

                        {!loadingInbox &&
                            !inboxError &&
                            inboxItems.length ===
                            0 && (
                                <div
                                    style={{
                                      padding:
                                          '44px 24px',
                                      border:
                                          '1px solid #e4e8eb',
                                      borderRadius:
                                          '12px',
                                      background:
                                          '#ffffff',
                                      textAlign:
                                          'center',
                                    }}
                                >

                                  <div
                                      style={{
                                        fontSize:
                                            '30px',
                                        marginBottom:
                                            '10px',
                                      }}
                                  >
                                    ✓
                                  </div>

                                  <strong>
                                    Attention queue clear
                                  </strong>

                                  <p
                                      style={{
                                        margin:
                                            '7px 0 0',
                                        color:
                                            '#78858e',
                                        fontSize:
                                            '13px',
                                      }}
                                  >
                                    There is currently no matched patient communication waiting for staff attention.
                                  </p>

                                </div>
                            )}

                        {inboxItems.length >
                            0 && (
                            <div
                                style={{
                                  display:
                                      'flex',
                                  flexDirection:
                                      'column',
                                  gap: '12px',
                                }}
                            >

                              {inboxItems.map(
                                  (item) => {
                                    const activity =
                                        item.activity

                                    const status =
                                        activity.type ===
                                        'CALL'
                                            ? activity.followUpStatus
                                            : activity.emailStatus

                                    const updating =
                                        activity.type ===
                                        'CALL'
                                            ? updatingCallFollowUpId ===
                                              activity.id
                                            : updatingEmailStatusId ===
                                              activity.id

                                    return (
                                        <article
                                            key={`${activity.type}-${activity.id}`}
                                            style={{
                                              border:
                                                  '1px solid #e4e8eb',
                                              borderRadius:
                                                  '12px',
                                              background:
                                                  '#ffffff',
                                              padding:
                                                  '18px 20px',
                                              boxShadow:
                                                  '0 1px 2px rgba(31, 45, 55, 0.04)',
                                            }}
                                        >

                                          <div
                                              style={{
                                                display:
                                                    'flex',
                                                alignItems:
                                                    'flex-start',
                                                justifyContent:
                                                    'space-between',
                                                gap:
                                                    '16px',
                                              }}
                                          >

                                            <div
                                                style={{
                                                  minWidth:
                                                      0,
                                                  display:
                                                      'flex',
                                                  gap:
                                                      '12px',
                                                  flex:
                                                      1,
                                                }}
                                            >

                                              <div
                                                  style={{
                                                    width:
                                                        '34px',
                                                    height:
                                                        '34px',
                                                    borderRadius:
                                                        '9px',
                                                    background:
                                                        activity.type ===
                                                        'EMAIL'
                                                            ? '#eef5ff'
                                                            : '#f2f4f5',
                                                    display:
                                                        'flex',
                                                    alignItems:
                                                        'center',
                                                    justifyContent:
                                                        'center',
                                                    flexShrink:
                                                        0,
                                                    fontSize:
                                                        '16px',
                                                  }}
                                              >
                                                {activityIcon(
                                                    activity.type,
                                                )}
                                              </div>

                                              <div
                                                  style={{
                                                    minWidth:
                                                        0,
                                                    flex:
                                                        1,
                                                  }}
                                              >

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openPatientFromInbox(
                                                            item.patientId,
                                                        )
                                                    }
                                                    style={{
                                                      border:
                                                          0,
                                                      padding:
                                                          0,
                                                      background:
                                                          'transparent',
                                                      color:
                                                          '#26343d',
                                                      fontWeight:
                                                          800,
                                                      fontSize:
                                                          '14px',
                                                      cursor:
                                                          'pointer',
                                                      textAlign:
                                                          'left',
                                                    }}
                                                >
                                                  {item.patientFirstName}{' '}
                                                  {item.patientLastName}
                                                </button>

                                                <div
                                                    style={{
                                                      display:
                                                          'flex',
                                                      alignItems:
                                                          'center',
                                                      flexWrap:
                                                          'wrap',
                                                      gap:
                                                          '8px',
                                                      marginTop:
                                                          '5px',
                                                    }}
                                                >

                                                  <strong
                                                      style={{
                                                        fontSize:
                                                            '13px',
                                                      }}
                                                  >
                                                    {getActivityTitle(
                                                        activity,
                                                    )}
                                                  </strong>

                                                  <span className={`direction-badge ${
                                                    activity.callDirection === 'OUTBOUND' ||
                                                    activity.emailDirection === 'OUTBOUND'
                                                        ? 'outbound'
                                                        : 'inbound'
                                                  }`}>
                                                    {activity.callDirection === 'OUTBOUND' ||
                                                    activity.emailDirection === 'OUTBOUND'
                                                        ? 'Outgoing'
                                                        : 'Incoming'}
                                                  </span>

                                                  {status && (
                                                      <span
                                                          style={{
                                                            display:
                                                                'inline-flex',
                                                            alignItems:
                                                                'center',
                                                            padding:
                                                                '3px 7px',
                                                            borderRadius:
                                                                '999px',
                                                            fontSize:
                                                                '10px',
                                                            fontWeight:
                                                                800,
                                                            ...(
                                                                getStatusBadgeStyle(
                                                                    status,
                                                                )
                                                            ),
                                                          }}
                                                      >
                                                        {formatStatus(
                                                            status,
                                                        )}
                                                      </span>
                                                  )}

                                                </div>

                                                {activity.type ===
                                                    'CALL' && (
                                                    <div
                                                        style={{
                                                          marginTop:
                                                              '8px',
                                                          color:
                                                              '#5d6a72',
                                                          fontSize:
                                                              '13px',
                                                        }}
                                                    >
                                                      {activity.callDirection === 'OUTBOUND'
                                                          ? 'To '
                                                          : 'From '}
                                                      {activity.counterpartyNumber ??
                                                          'Private / withheld number'}
                                                      {formatCallDuration(
                                                          activity.durationSeconds,
                                                      ) &&
                                                          ` · ${formatCallDuration(
                                                              activity.durationSeconds,
                                                          )}`}
                                                    </div>
                                                )}

                                                {activity.type ===
                                                    'EMAIL' && (
                                                    <>
                                                      <div
                                                          style={{
                                                            marginTop:
                                                                '8px',
                                                            color:
                                                                '#5d6a72',
                                                            fontSize:
                                                                '13px',
                                                            overflowWrap:
                                                                'anywhere',
                                                          }}
                                                      >
                                                        {activity.emailDirection ===
                                                        'INBOUND'
                                                            ? `From ${activity.fromAddress ?? 'Unknown sender'}`
                                                            : `To ${activity.toAddress ?? 'Unknown recipient'}`}
                                                      </div>

                                                      {activity.text && (
                                                          <div
                                                              style={{
                                                                marginTop:
                                                                    '7px',
                                                                color:
                                                                    '#4c5b64',
                                                                fontSize:
                                                                    '13px',
                                                                whiteSpace:
                                                                    'pre-wrap',
                                                                overflowWrap:
                                                                    'anywhere',
                                                              }}
                                                          >
                                                            {activity.text.length >
                                                            220
                                                                ? `${activity.text.slice(
                                                                    0,
                                                                    220,
                                                                )}…`
                                                                : activity.text}
                                                          </div>
                                                      )}
                                                    </>
                                                )}

                                              </div>

                                            </div>

                                            <span
                                                style={{
                                                  color:
                                                      '#8a969e',
                                                  fontSize:
                                                      '11px',
                                                  whiteSpace:
                                                      'nowrap',
                                                }}
                                            >
                                              {formatActivityTime(
                                                  activity.occurredAt,
                                              )}
                                            </span>

                                          </div>

                                          <div
                                              style={{
                                                display:
                                                    'flex',
                                                alignItems:
                                                    'center',
                                                flexWrap:
                                                    'wrap',
                                                gap:
                                                    '8px',
                                                marginTop:
                                                    '16px',
                                                paddingTop:
                                                    '14px',
                                                borderTop:
                                                    '1px solid #eef1f3',
                                              }}
                                          >

                                            {activity.type ===
                                                'EMAIL' &&
                                                activity.emailDirection ===
                                                'INBOUND' &&
                                                activity.emailStatus ===
                                                'UNREAD' && (
                                                    <>
                                                      <button
                                                          type="button"
                                                          className="secondary-button"
                                                          disabled={
                                                            updating
                                                          }
                                                          onClick={() =>
                                                              void handleUpdateEmailStatus(
                                                                  activity,
                                                                  'AWAITING_REPLY',
                                                              )
                                                          }
                                                      >
                                                        Needs reply
                                                      </button>

                                                      <button
                                                          type="button"
                                                          className="secondary-button"
                                                          disabled={
                                                            updating
                                                          }
                                                          onClick={() =>
                                                              void handleUpdateEmailStatus(
                                                                  activity,
                                                                  'RESOLVED',
                                                              )
                                                          }
                                                      >
                                                        Resolve
                                                      </button>
                                                    </>
                                                )}

                                            {activity.type ===
                                                'EMAIL' &&
                                                activity.emailDirection ===
                                                'INBOUND' &&
                                                activity.emailStatus ===
                                                'AWAITING_REPLY' && (
                                                    <>
                                                      <button
                                                          type="button"
                                                          className="secondary-button"
                                                          disabled={
                                                            updating
                                                          }
                                                          onClick={() =>
                                                              void handleUpdateEmailStatus(
                                                                  activity,
                                                                  'UNREAD',
                                                              )
                                                          }
                                                      >
                                                        Mark unread
                                                      </button>

                                                      <button
                                                          type="button"
                                                          className="secondary-button"
                                                          disabled={
                                                            updating
                                                          }
                                                          onClick={() =>
                                                              void handleUpdateEmailStatus(
                                                                  activity,
                                                                  'RESOLVED',
                                                              )
                                                          }
                                                      >
                                                        Resolve
                                                      </button>
                                                    </>
                                                )}

                                            {activity.type ===
                                                'CALL' &&
                                                activity.followUpStatus ===
                                                'NOT_REVIEWED' && (
                                                    <>
                                                      <button
                                                          type="button"
                                                          className="secondary-button"
                                                          disabled={
                                                            updating
                                                          }
                                                          onClick={() =>
                                                              void handleUpdateCallFollowUp(
                                                                  activity,
                                                                  'FOLLOW_UP_REQUIRED',
                                                              )
                                                          }
                                                      >
                                                        Follow up
                                                      </button>

                                                      <button
                                                          type="button"
                                                          className="secondary-button"
                                                          disabled={
                                                            updating
                                                          }
                                                          onClick={() =>
                                                              void handleUpdateCallFollowUp(
                                                                  activity,
                                                                  'RESOLVED',
                                                              )
                                                          }
                                                      >
                                                        Resolve
                                                      </button>
                                                    </>
                                                )}

                                            {activity.type ===
                                                'CALL' &&
                                                activity.followUpStatus ===
                                                'FOLLOW_UP_REQUIRED' && (
                                                    <>
                                                      <button
                                                          type="button"
                                                          className="secondary-button"
                                                          disabled={
                                                            updating
                                                          }
                                                          onClick={() =>
                                                              void handleUpdateCallFollowUp(
                                                                  activity,
                                                                  'NOT_REVIEWED',
                                                              )
                                                          }
                                                      >
                                                        Not reviewed
                                                      </button>

                                                      <button
                                                          type="button"
                                                          className="secondary-button"
                                                          disabled={
                                                            updating
                                                          }
                                                          onClick={() =>
                                                              void handleUpdateCallFollowUp(
                                                                  activity,
                                                                  'RESOLVED',
                                                              )
                                                          }
                                                      >
                                                        Resolve
                                                      </button>
                                                    </>
                                                )}

                                            {activity.type ===
                                                'EMAIL' &&
                                                activity.emailDirection ===
                                                'OUTBOUND' &&
                                                activity.emailStatus ===
                                                'FAILED' && (
                                                    <span
                                                        style={{
                                                          fontSize:
                                                              '12px',
                                                          color:
                                                              '#a53d3d',
                                                          fontWeight:
                                                              700,
                                                        }}
                                                    >
                                                      Delivery failed — open the patient to review or resend.
                                                    </span>
                                                )}

                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={() =>
                                                    openPatientFromInbox(
                                                        item.patientId,
                                                    )
                                                }
                                                style={{
                                                  marginLeft:
                                                      'auto',
                                                }}
                                            >
                                              Open patient
                                            </button>

                                          </div>

                                        </article>
                                    )
                                  },
                              )}

                            </div>
                        )}

                      </>
                  )}

                  {inboxTab ===
                      'UNMATCHED' && (
                      <>

                        {unmatchedError && (
                            <div
                                className="activity-action-error"
                                style={{
                                  marginBottom:
                                      '16px',
                                }}
                            >
                              {unmatchedError}
                            </div>
                        )}

                        {loadingUnmatched &&
                            unmatchedCommunications.length ===
                            0 && (
                                <div>
                                  Loading unmatched communication...
                                </div>
                            )}

                        {!loadingUnmatched &&
                            !unmatchedError &&
                            unmatchedCommunications.length ===
                            0 && (
                                <div
                                    style={{
                                      padding:
                                          '44px 24px',
                                      border:
                                          '1px solid #e4e8eb',
                                      borderRadius:
                                          '12px',
                                      background:
                                          '#ffffff',
                                      textAlign:
                                          'center',
                                    }}
                                >

                                  <div
                                      style={{
                                        fontSize:
                                            '30px',
                                        marginBottom:
                                            '10px',
                                      }}
                                  >
                                    ✓
                                  </div>

                                  <strong>
                                    No unmatched communication
                                  </strong>

                                  <p
                                      style={{
                                        margin:
                                            '7px 0 0',
                                        color:
                                            '#78858e',
                                        fontSize:
                                            '13px',
                                      }}
                                  >
                                    Calls and emails that cannot be matched automatically will appear here.
                                  </p>

                                </div>
                            )}

                        {unmatchedCommunications.length >
                            0 && (
                            <div
                                style={{
                                  display:
                                      'flex',
                                  flexDirection:
                                      'column',
                                  gap: '12px',
                                }}
                            >

                              {unmatchedCommunications.map(
                                  (item) => (
                                      <article
                                          key={`${item.type}-${item.id}`}
                                          style={{
                                            border:
                                                '1px solid #e4e8eb',
                                            borderRadius:
                                                '12px',
                                            background:
                                                '#ffffff',
                                            padding:
                                                '18px 20px',
                                            boxShadow:
                                                '0 1px 2px rgba(31, 45, 55, 0.04)',
                                          }}
                                      >

                                        <div
                                            style={{
                                              display:
                                                  'flex',
                                              alignItems:
                                                  'flex-start',
                                              justifyContent:
                                                  'space-between',
                                              gap:
                                                  '16px',
                                            }}
                                        >

                                          <div
                                              style={{
                                                display:
                                                    'flex',
                                                gap:
                                                    '12px',
                                                minWidth:
                                                    0,
                                                flex:
                                                    1,
                                              }}
                                          >

                                            <div
                                                style={{
                                                  width:
                                                      '34px',
                                                  height:
                                                      '34px',
                                                  borderRadius:
                                                      '9px',
                                                  background:
                                                      item.type ===
                                                      'EMAIL'
                                                          ? '#eef5ff'
                                                          : '#f2f4f5',
                                                  display:
                                                      'flex',
                                                  alignItems:
                                                      'center',
                                                  justifyContent:
                                                      'center',
                                                  flexShrink:
                                                      0,
                                                  fontSize:
                                                      '16px',
                                                }}
                                            >
                                              {activityIcon(
                                                  item.type,
                                              )}
                                            </div>

                                            <div
                                                style={{
                                                  minWidth:
                                                      0,
                                                  flex:
                                                      1,
                                                }}
                                            >

                                              <div
                                                  style={{
                                                    display:
                                                        'flex',
                                                    alignItems:
                                                        'center',
                                                    gap:
                                                        '8px',
                                                    flexWrap:
                                                        'wrap',
                                                  }}
                                              >

                                                <strong>
                                                  {item.title}
                                                </strong>

                                                <span
                                                    style={{
                                                      display:
                                                          'inline-flex',
                                                      alignItems:
                                                          'center',
                                                      padding:
                                                          '3px 7px',
                                                      borderRadius:
                                                          '999px',
                                                      fontSize:
                                                          '10px',
                                                      fontWeight:
                                                          800,
                                                      background:
                                                          item.matchStatus ===
                                                          'AMBIGUOUS'
                                                              ? '#fff7e6'
                                                              : '#fff0f0',
                                                      color:
                                                          item.matchStatus ===
                                                          'AMBIGUOUS'
                                                              ? '#98661a'
                                                              : '#a53d3d',
                                                      border:
                                                          item.matchStatus ===
                                                          'AMBIGUOUS'
                                                              ? '1px solid #f0d9a8'
                                                              : '1px solid #f2caca',
                                                    }}
                                                >
                                                  {item.matchStatus ===
                                                  'AMBIGUOUS'
                                                      ? 'Multiple matches'
                                                      : 'No patient matched'}
                                                </span>

                                              </div>

                                              <div
                                                  style={{
                                                    marginTop:
                                                        '7px',
                                                    color:
                                                        '#5d6a72',
                                                    fontSize:
                                                        '13px',
                                                    overflowWrap:
                                                        'anywhere',
                                                  }}
                                              >
                                                {item.contact}
                                              </div>

                                              {item.preview && (
                                                  <div
                                                      style={{
                                                        marginTop:
                                                            '8px',
                                                        color:
                                                            '#4c5b64',
                                                        fontSize:
                                                            '13px',
                                                        whiteSpace:
                                                            'pre-wrap',
                                                        overflowWrap:
                                                            'anywhere',
                                                      }}
                                                  >
                                                    {item.preview.length >
                                                    220
                                                        ? `${item.preview.slice(
                                                            0,
                                                            220,
                                                        )}…`
                                                        : item.preview}
                                                  </div>
                                              )}

                                            </div>

                                          </div>

                                          <span
                                              style={{
                                                color:
                                                    '#8a969e',
                                                fontSize:
                                                    '11px',
                                                whiteSpace:
                                                    'nowrap',
                                              }}
                                          >
                                            {formatActivityTime(
                                                item.occurredAt,
                                            )}
                                          </span>

                                        </div>

                                        <div
                                            style={{
                                              display:
                                                  'flex',
                                              justifyContent:
                                                  'space-between',
                                              gap:
                                                  '10px',
                                              marginTop:
                                                  '16px',
                                              paddingTop:
                                                  '14px',
                                              borderTop:
                                                  '1px solid #eef1f3',
                                            }}
                                        >
                                          <button
                                              type="button"
                                              className="secondary-button"
                                              onClick={() =>
                                                  openDismissal(
                                                      item.type,
                                                      item.id,
                                                      item.title,
                                                      item.contact,
                                                      item.canReuseSource,
                                                  )
                                              }
                                          >
                                            Dismiss
                                          </button>

                                          <button
                                              type="button"
                                              className="secondary-button"
                                              onClick={() =>
                                                  openPatientAssignment(
                                                      item.type,
                                                      item.id,
                                                      item.type ===
                                                      'CALL'
                                                          ? item.contact
                                                          : item.title,
                                                      item.contact,
                                                      item.canReuseSource,
                                                  )
                                              }
                                          >
                                            Assign patient
                                          </button>
                                        </div>

                                      </article>
                                  ),
                              )}

                            </div>
                        )}

                      </>
                  )}

                  {(
                      inboxTab === 'DISMISSED' ||
                      inboxTab === 'RESOLVED' ||
                      inboxTab === 'ALL'
                  ) && (
                      <>
                        <section className="inbox-history-panel">
                          <div className="inbox-history-heading">
                            <div>
                              <strong>Today</strong>
                              <span>
                                {formatHistoryDate(
                                    todayHistoryDate,
                                )}
                              </span>
                            </div>

                            <span className="inbox-history-count">
                              {inboxDailyHistory.length}{' '}
                              {inboxDailyHistory.length === 1
                                  ? 'communication'
                                  : 'communications'}
                            </span>
                          </div>
                        </section>

                        {unmatchedError && (
                            <div
                                className="activity-action-error"
                                style={{
                                  marginBottom: '16px',
                                }}
                            >
                              {unmatchedError}
                            </div>
                        )}

                        {loadingUnmatched &&
                            communicationHistory.length === 0 && (
                                <div>
                                  Loading today's communication...
                                </div>
                            )}

                        {!loadingUnmatched &&
                            inboxDailyHistory.length === 0 && (
                                <div className="inbox-history-empty">
                                  <strong>
                                    No {inboxTab === 'DISMISSED'
                                        ? 'dismissed'
                                        : inboxTab === 'RESOLVED'
                                            ? 'resolved'
                                            : ''}{' '}
                                    communication today
                                  </strong>

                                  <p>
                                    History contains older communication and lets you browse other dates.
                                  </p>
                                </div>
                            )}

                        {inboxDailyHistory.length > 0 &&
                            renderCommunicationHistoryCards(
                                inboxDailyHistory,
                                inboxTab === 'DISMISSED',
                            )}
                      </>
                  )}


                </div>

              </div>
          )}

          {/* HISTORY */}

          {appView === 'HISTORY' && (
              <div
                  style={{
                    padding: '28px 32px 40px',
                    overflowY: 'auto',
                    flex: 1,
                  }}
              >
                <div
                    style={{
                      maxWidth: '980px',
                      margin: '0 auto',
                    }}
                >
                  <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '16px',
                        marginBottom: '18px',
                      }}
                  >
                    <div>
                      <h2
                          style={{
                            margin: 0,
                            fontSize: '22px',
                          }}
                      >
                        History
                      </h2>

                      <p
                          style={{
                            margin: '6px 0 0',
                            color: '#78858e',
                            fontSize: '13px',
                          }}
                      >
                        Explore every call, email and staff note across the practice.
                      </p>
                    </div>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                            void refreshHistory()
                        }
                        disabled={loadingHistory}
                    >
                      {loadingHistory
                          ? 'Refreshing...'
                          : 'Refresh'}
                    </button>
                  </div>

                  <section className="history-filter-panel">
                    <div className="history-filter-header">
                      <div>
                        <strong>Filters</strong>
                        <span>Date and activity type are ready for quick filtering.</span>
                      </div>

                      <div className="history-filter-header-actions">
                        <button
                            type="button"
                            className="secondary-button history-expand-button"
                            aria-expanded={historyFiltersExpanded}
                            onClick={() =>
                                setHistoryFiltersExpanded(
                                    (expanded) => !expanded,
                                )
                            }
                        >
                          {historyFiltersExpanded
                              ? 'Fewer filters'
                              : 'More filters'}
                          {(historyCallOutcomes.length + historyWorkflows.length) > 0 && (
                              <span className="advanced-filter-count">
                                {historyCallOutcomes.length + historyWorkflows.length}
                              </span>
                          )}
                          <span aria-hidden="true">
                            {historyFiltersExpanded ? '⌃' : '⌄'}
                          </span>
                        </button>

                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              const today = toLocalDateValue(new Date())
                              setHistoryDateMode('TODAY')
                              setHistoryFromDate(today)
                              setHistoryToDate(today)
                              setHistoryTypes(['CALL', 'EMAIL', 'NOTE'])
                              setHistoryCallOutcomes([])
                              setHistoryWorkflows([])
                            }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className={`history-filter-grid ${
                      historyFiltersExpanded ? 'expanded' : 'collapsed'
                    }`}>
                      <fieldset className="history-filter-group">
                        <legend>Date</legend>

                        {([
                          ['TODAY', 'Today'],
                          ['YESTERDAY', 'Yesterday'],
                          ['CUSTOM', 'Custom range'],
                          ['ALL_TIME', 'All time'],
                        ] as const).map(([value, label]) => (
                            <label key={value}>
                              <input
                                  type="radio"
                                  name="history-date"
                                  checked={historyDateMode === value}
                                  onChange={() => {
                                    setHistoryDateMode(value)
                                    if (value === 'TODAY') {
                                      const today = toLocalDateValue(new Date())
                                      setHistoryFromDate(today)
                                      setHistoryToDate(today)
                                    }
                                    if (value === 'YESTERDAY') {
                                      const yesterday = shiftDateValue(
                                          toLocalDateValue(new Date()),
                                          -1,
                                      )
                                      setHistoryFromDate(yesterday)
                                      setHistoryToDate(yesterday)
                                    }
                                  }}
                              />
                              {label}
                            </label>
                        ))}
                      </fieldset>

                      <fieldset className="history-filter-group">
                        <legend>Type</legend>

                        {([
                          ['CALL', 'Calls'],
                          ['EMAIL', 'Emails'],
                          ['NOTE', 'Notes'],
                        ] as const).map(([value, label]) => (
                            <label key={value}>
                              <input
                                  type="checkbox"
                                  checked={historyTypes.includes(value)}
                                  onChange={() => toggleHistoryType(value)}
                              />
                              {label}
                            </label>
                        ))}
                      </fieldset>

                      {historyFiltersExpanded && (
                          <>
                            <fieldset className="history-filter-group history-advanced-filter">
                              <legend>Call outcome</legend>

                              {([
                                ['COMPLETED', 'Completed'],
                                ['MISSED', 'Missed'],
                                ['NO_ANSWER', 'No answer'],
                                ['ANSWERED', 'Answered'],
                              ] as const).map(([value, label]) => (
                                  <label key={value}>
                                    <input
                                        type="checkbox"
                                        checked={historyCallOutcomes.includes(value)}
                                        onChange={() => toggleHistoryCallOutcome(value)}
                                    />
                                    {label}
                                  </label>
                              ))}
                            </fieldset>

                            <fieldset className="history-filter-group history-advanced-filter">
                              <legend>Workflow</legend>

                              {([
                                ['NEEDS_ATTENTION', 'Needs attention'],
                                ['RESOLVED', 'Resolved'],
                                ['DISMISSED', 'Dismissed'],
                                ['UNMATCHED', 'Unmatched'],
                              ] as const).map(([value, label]) => (
                                  <label key={value}>
                                    <input
                                        type="checkbox"
                                        checked={historyWorkflows.includes(value)}
                                        onChange={() => toggleHistoryWorkflow(value)}
                                    />
                                    {label}
                                  </label>
                              ))}
                            </fieldset>
                          </>
                      )}
                    </div>

                    {historyDateMode === 'CUSTOM' && (
                        <div className="history-custom-range">
                          <label>
                            From
                            <input
                                type="date"
                                value={historyFromDate}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setHistoryFromDate(value)
                                  if (value > historyToDate) {
                                    setHistoryToDate(value)
                                  }
                                }}
                            />
                          </label>

                          <label>
                            To
                            <input
                                type="date"
                                value={historyToDate}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setHistoryToDate(value)
                                  if (value < historyFromDate) {
                                    setHistoryFromDate(value)
                                  }
                                }}
                            />
                          </label>
                        </div>
                    )}

                    <div className="history-result-summary">
                      <strong>
                        {filteredHistory.length}{' '}
                        {filteredHistory.length === 1 ? 'activity' : 'activities'}
                      </strong>
                      <span>Newest first</span>
                    </div>
                  </section>

                  <section className="inbox-history-panel legacy-history-date-panel">
                    <div className="inbox-history-heading">
                      <div>
                        <strong>Communication history</strong>
                        <span>
                          {historyFromDate === historyToDate
                              ? formatHistoryDate(
                                  historyFromDate,
                              )
                              : `${formatHistoryDate(
                                  historyFromDate,
                              )} – ${formatHistoryDate(
                                  historyToDate,
                              )}`}
                        </span>
                      </div>

                      <div className="inbox-history-presets">
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              const previousFrom =
                                  shiftDateValue(
                                      historyFromDate,
                                      -1,
                                  )
                              const previousTo =
                                  shiftDateValue(
                                      historyToDate,
                                      -1,
                                  )
                              setHistoryFromDate(
                                  previousFrom,
                              )
                              setHistoryToDate(
                                  previousTo,
                              )
                            }}
                        >
                          ‹ Previous
                        </button>

                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              const today =
                                  toLocalDateValue(
                                      new Date(),
                                  )
                              setHistoryFromDate(today)
                              setHistoryToDate(today)
                            }}
                        >
                          Today
                        </button>

                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              setHistoryFromDate(
                                  shiftDateValue(
                                      historyFromDate,
                                      1,
                                  ),
                              )
                              setHistoryToDate(
                                  shiftDateValue(
                                      historyToDate,
                                      1,
                                  ),
                              )
                            }}
                        >
                          Next ›
                        </button>

                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              setHistoryFromDate(
                                  earliestHistoryDate,
                              )
                              setHistoryToDate(
                                  toLocalDateValue(
                                      new Date(),
                                  ),
                              )
                            }}
                        >
                          All time
                        </button>
                      </div>
                    </div>

                    <div className="inbox-history-date-range">
                      <label>
                        From
                        <input
                            type="date"
                            value={historyFromDate}
                            onChange={(event) => {
                              const value =
                                  event.target.value
                              setHistoryFromDate(value)
                              if (value > historyToDate) {
                                setHistoryToDate(value)
                              }
                            }}
                        />
                      </label>

                      <label>
                        To
                        <input
                            type="date"
                            value={historyToDate}
                            onChange={(event) => {
                              const value =
                                  event.target.value
                              setHistoryToDate(value)
                              if (value < historyFromDate) {
                                setHistoryFromDate(value)
                              }
                            }}
                        />
                      </label>

                      <span className="inbox-history-count">
                        {filteredHistory.length}{' '}
                        {filteredHistory.length === 1
                            ? 'communication'
                            : 'communications'}
                      </span>
                    </div>
                  </section>

                  {historyError && (
                      <div
                          className="activity-action-error"
                          style={{
                            marginBottom: '16px',
                          }}
                      >
                        {historyError}
                      </div>
                  )}

                  {loadingHistory &&
                      communicationHistory.length === 0 && (
                          <div>
                            Loading communication history...
                          </div>
                      )}

                  {!loadingHistory &&
                      filteredHistory.length === 0 && (
                          <div className="inbox-history-empty">
                            <strong>
                              No communication in this period
                            </strong>

                            <p>
                              Choose another day, date range or All time to inspect older communication.
                            </p>
                          </div>
                      )}

                  {pagedHistory.length > 0 &&
                      renderCommunicationHistoryCards(
                          pagedHistory,
                          true,
                      )}

                  {filteredHistory.length > HISTORY_PAGE_SIZE && (
                      <div className="inbox-history-pagination">
                        <button
                            type="button"
                            className="secondary-button"
                            disabled={historyPage <= 1}
                            onClick={() =>
                                setHistoryPage(
                                    (page) =>
                                        Math.max(
                                            1,
                                            page - 1,
                                        ),
                                )
                            }
                        >
                          Previous page
                        </button>

                        <span>
                          Page {historyPage} of{' '}
                          {historyTotalPages}
                        </span>

                        <button
                            type="button"
                            className="secondary-button"
                            disabled={
                              historyPage >= historyTotalPages
                            }
                            onClick={() =>
                                setHistoryPage(
                                    (page) =>
                                        Math.min(
                                            historyTotalPages,
                                            page + 1,
                                        ),
                                )
                            }
                        >
                          Next page
                        </button>
                      </div>
                  )}
                </div>
              </div>
          )}

          {pendingDismissal && (

              <div className="confirmation-backdrop">

                <div
                    className="confirmation-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="dismiss-communication-title"
                    style={{
                      width:
                          'min(520px, calc(100vw - 32px))',
                      maxWidth:
                          '520px',
                    }}
                >
                  <h3 id="dismiss-communication-title">
                    Dismiss communication
                  </h3>

                  <p>
                    Remove{' '}
                    <strong>
                      {pendingDismissal.label}
                    </strong>{' '}
                    from the active work queue. The record will be kept and can be restored later.
                  </p>

                  {pendingDismissal.canReuseSource && (
                  <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        marginTop: '14px',
                        padding: '12px 14px',
                        border: '1px solid #e4e8eb',
                        borderRadius: '10px',
                        background: '#f8fafb',
                        cursor: dismissalRunning
                            ? 'default'
                            : 'pointer',
                      }}
                  >
                    <input
                        type="checkbox"
                        checked={treatFutureAsSpam}
                        onChange={(event) =>
                            setTreatFutureAsSpam(
                                event.target.checked,
                            )
                        }
                        disabled={dismissalRunning}
                        style={{
                          marginTop: '2px',
                        }}
                    />

                    <span
                        style={{
                          color: '#53616a',
                          fontSize: '13px',
                          lineHeight: 1.45,
                        }}
                    >
                      Treat future{' '}
                      {pendingDismissal.type === 'CALL'
                          ? 'calls'
                          : 'emails'}{' '}
                      from{' '}
                      <strong>
                        {pendingDismissal.contact}
                      </strong>{' '}
                      as spam and dismiss them automatically.
                    </span>
                  </label>
                  )}

                  {dismissalError && (
                      <div
                          className="activity-action-error"
                          style={{
                            marginTop: '12px',
                          }}
                      >
                        {dismissalError}
                      </div>
                  )}

                  <div className="confirmation-actions">
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={closeDismissal}
                        disabled={dismissalRunning}
                    >
                      Cancel
                    </button>

                    <button
                        type="button"
                        className="danger-button"
                        onClick={() =>
                            void handleDismissCommunication()
                        }
                        disabled={dismissalRunning}
                    >
                      {dismissalRunning
                          ? 'Dismissing...'
                          : 'Dismiss'}
                    </button>
                  </div>
                </div>
              </div>
          )}

          {pendingPatientAssignment && (

              <div className="confirmation-backdrop">

                <div
                    className="confirmation-dialog assignment-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="assign-patient-title"
                    style={{
                      width:
                          'min(560px, calc(100vw - 32px))',
                      maxWidth:
                          '560px',
                    }}
                >

                  <h3 id="assign-patient-title">
                    Assign patient
                  </h3>

                  <p>
                    Match{' '}
                    <strong>
                      {pendingPatientAssignment.label}
                    </strong>{' '}
                    to the correct patient.
                  </p>

                  <input
                      className="patient-search"
                      placeholder="Search patient name or ID..."
                      value={assignmentSearch}
                      onChange={(event) => {
                        setAssignmentSearch(
                            event.target.value,
                        )
                        setAssignmentPatientId(
                            null,
                        )
                      }}
                      autoFocus
                      style={{
                        width: '100%',
                        marginBottom: '12px',
                      }}
                  />

                  <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        border: '1px solid #e4e8eb',
                        borderRadius: '10px',
                        padding: '6px',
                      }}
                  >

                    {assignmentPatients.length ===
                        0 && (
                        <div
                            style={{
                              padding:
                                  '14px',
                              color:
                                  '#78858e',
                              fontSize:
                                  '13px',
                            }}
                        >
                          No patients found.
                        </div>
                    )}

                    {assignmentPatients.map(
                        (patient) => {
                          const selected =
                              assignmentPatientId ===
                              patient.id

                          return (
                              <button
                                  key={
                                    patient.id
                                  }
                                  type="button"
                                  onClick={() => {
                                    setAssignmentPatientId(
                                        patient.id,
                                    )
                                    setAssignmentError(
                                        null,
                                    )
                                  }}
                                  style={{
                                    width:
                                        '100%',
                                    border:
                                        selected
                                            ? '1px solid #8eb4df'
                                            : '1px solid transparent',
                                    borderRadius:
                                        '8px',
                                    background:
                                        selected
                                            ? '#eef5ff'
                                            : '#ffffff',
                                    padding:
                                        '10px 12px',
                                    cursor:
                                        'pointer',
                                    textAlign:
                                        'left',
                                    display:
                                        'flex',
                                    justifyContent:
                                        'space-between',
                                    alignItems:
                                        'center',
                                    gap:
                                        '12px',
                                  }}
                              >
                                <strong>
                                  {patient.firstName}{' '}
                                  {patient.lastName}
                                </strong>

                                <span
                                    style={{
                                      color:
                                          '#8a969e',
                                      fontSize:
                                          '11px',
                                    }}
                                >
                                  #{patient.id}
                                </span>
                              </button>
                          )
                        },
                    )}

                  </div>

                  {pendingSameSourceCount > 0 && (
                      <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            marginTop: '12px',
                            padding: '12px 14px',
                            border: '1px solid #e4e8eb',
                            borderRadius: '10px',
                            background: '#f8fafb',
                            cursor: assignmentRunning
                                ? 'default'
                                : 'pointer',
                          }}
                      >
                        <input
                            type="checkbox"
                            checked={assignSameSource}
                            onChange={(event) =>
                                setAssignSameSource(
                                    event.target.checked,
                                )
                            }
                            disabled={assignmentRunning}
                            style={{
                              marginTop: '2px',
                            }}
                        />

                        <span
                            style={{
                              color: '#53616a',
                              fontSize: '13px',
                              lineHeight: 1.45,
                            }}
                        >
                          Also assign{' '}
                          <strong>
                            {pendingSameSourceCount}
                          </strong>{' '}
                          other unassigned{' '}
                          {pendingPatientAssignment.type === 'CALL'
                              ? pendingSameSourceCount === 1
                                  ? 'call'
                                  : 'calls'
                              : pendingSameSourceCount === 1
                                  ? 'email'
                                  : 'emails'}{' '}
                          from this{' '}
                          {pendingPatientAssignment.type === 'CALL'
                              ? 'number'
                              : 'address'}.
                        </span>
                      </label>
                  )}

                  {pendingPatientAssignment.canReuseSource && (
                  <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        marginTop: '12px',
                        padding: '12px 14px',
                        border: '1px solid #e4e8eb',
                        borderRadius: '10px',
                        background: '#f8fafb',
                        cursor: assignmentRunning
                            ? 'default'
                            : 'pointer',
                      }}
                  >
                    <input
                        type="checkbox"
                        checked={saveSourceAsContact}
                        onChange={(event) =>
                            setSaveSourceAsContact(
                                event.target.checked,
                            )
                        }
                        disabled={assignmentRunning}
                        style={{
                          marginTop: '2px',
                        }}
                    />

                    <span
                        style={{
                          color: '#53616a',
                          fontSize: '13px',
                          lineHeight: 1.45,
                        }}
                    >
                      Save{' '}
                      <strong>
                        {pendingPatientAssignment.contact}
                      </strong>{' '}
                      to this patient's{' '}
                      {pendingPatientAssignment.type === 'CALL'
                          ? 'phone numbers'
                          : 'email addresses'}{' '}
                      so future{' '}
                      {pendingPatientAssignment.type === 'CALL'
                          ? 'calls'
                          : 'emails'}{' '}
                      from this contact can match automatically.
                    </span>
                  </label>
                  )}

                  {assignmentError && (
                      <div
                          className="activity-action-error"
                          style={{
                            marginTop:
                                '12px',
                          }}
                      >
                        {assignmentError}
                      </div>
                  )}

                  <div className="confirmation-actions assignment-actions">

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={
                          closePatientAssignment
                        }
                        disabled={
                          assignmentRunning
                        }
                    >
                      Cancel
                    </button>

                    <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                            void handleAssignPatient()
                        }
                        disabled={
                          assignmentRunning ||
                          assignmentPatientId ===
                          null
                        }
                    >
                      {assignmentRunning
                          ? 'Assigning...'
                          : 'Assign patient'}
                    </button>

                  </div>

                </div>

              </div>
          )}

          {/* CREATE PATIENT */}

          {creatingPatient && (

              <div className="confirmation-backdrop">

                <div
                    className="confirmation-dialog create-patient-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="create-patient-title"
                    style={{
                      width: 'min(520px, calc(100vw - 32px))',
                      maxWidth: '520px',
                    }}
                >

                  <h3 id="create-patient-title">
                    New patient
                  </h3>

                  <p>
                    Add the patient's basic details. Date of birth helps distinguish patients with similar or incorrectly entered names.
                  </p>

                  <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                            'repeat(2, minmax(0, 1fr))',
                        gap: '12px',
                        marginTop: '16px',
                      }}
                  >

                    <label
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#52616d',
                        }}
                    >
                      First name

                      <input
                          className="floating-subject-input"
                          value={
                            createFirstName
                          }
                          onChange={(event) =>
                              setCreateFirstName(
                                  event.target.value,
                              )
                          }
                          disabled={
                            creatingPatientRequest
                          }
                          maxLength={100}
                          autoFocus
                      />
                    </label>

                    <label
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#52616d',
                        }}
                    >
                      Last name

                      <input
                          className="floating-subject-input"
                          value={
                            createLastName
                          }
                          onChange={(event) =>
                              setCreateLastName(
                                  event.target.value,
                              )
                          }
                          disabled={
                            creatingPatientRequest
                          }
                          maxLength={100}
                      />
                    </label>

                  </div>

                  <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '14px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#52616d',
                      }}
                  >
                    Date of birth

                    <input
                        type="text"
                        className="floating-subject-input"
                        placeholder="DD/MM/YYYY"
                        autoComplete="bday"
                        maxLength={10}
                        value={createDateOfBirth}
                        onChange={(event) =>
                            setCreateDateOfBirth(
                                event.target.value,
                            )
                        }
                        disabled={
                          creatingPatientRequest
                        }
                    />
                  </label>

                  <div
                      style={{
                        marginTop: '8px',
                        color: '#87939c',
                        fontSize: '11px',
                      }}
                  >
                    Optional for the demo. Type the date as DD/MM/YYYY; it can be used to identify and search for the correct patient.
                  </div>

                  <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '14px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#52616d',
                      }}
                  >
                    Phone number

                    <input
                        className="floating-subject-input"
                        placeholder="+353... (optional)"
                        value={
                          createPhoneNumber
                        }
                        onChange={(event) =>
                            setCreatePhoneNumber(
                                event.target.value,
                            )
                        }
                        disabled={
                          creatingPatientRequest
                        }
                        maxLength={32}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleCreatePatient()
                          }
                        }}
                    />
                  </label>

                  <div
                      style={{
                        marginTop: '8px',
                        color: '#87939c',
                        fontSize: '11px',
                      }}
                  >
                    Optional. If supplied, this becomes the patient's primary phone number.
                  </div>

                  <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '14px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#52616d',
                      }}
                  >
                    Email address

                    <input
                        className="floating-subject-input"
                        type="email"
                        placeholder="patient@example.com (optional)"
                        value={
                          createEmailAddress
                        }
                        onChange={(event) =>
                            setCreateEmailAddress(
                                event.target.value,
                            )
                        }
                        disabled={
                          creatingPatientRequest
                        }
                        maxLength={320}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleCreatePatient()
                          }
                        }}
                    />
                  </label>

                  <div
                      style={{
                        marginTop: '8px',
                        color: '#87939c',
                        fontSize: '11px',
                      }}
                  >
                    Optional. If supplied, this becomes the patient's primary email address.
                  </div>

                  {createPatientError && (

                      <div
                          style={{
                            marginTop: '14px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: '#fff1f1',
                            color: '#a63d3d',
                            fontSize: '13px',
                          }}
                      >
                        {createPatientError}
                      </div>

                  )}

                  <div className="confirmation-actions create-patient-actions">

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={
                          closeCreatePatient
                        }
                        disabled={
                          creatingPatientRequest
                        }
                    >
                      Cancel
                    </button>

                    <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                            void handleCreatePatient()
                        }
                        disabled={
                          creatingPatientRequest ||
                          !createFirstName.trim() ||
                          !createLastName.trim()
                        }
                    >
                      {creatingPatientRequest
                          ? 'Creating...'
                          : 'Create patient'}
                    </button>

                  </div>

                </div>

              </div>

          )}

        </main>

      </div>
  )
}

export default App
