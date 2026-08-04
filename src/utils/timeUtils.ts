/**
 * Time utility functions explicitly supporting India Standard Time (IST / GMT+5:30)
 */

export type ExamAvailabilityState = 'draft' | 'archived' | 'upcoming' | 'active' | 'expired';

/**
 * Format timestamp in India Standard Time (IST)
 * Example output: "04 Aug 2026, 03:30 PM IST"
 */
export const formatInIST = (timestamp?: number | null, includeSeconds = false): string => {
  if (!timestamp) return 'No date set';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid date';

  const formatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  }).format(date);

  return `${formatted} IST`;
};

/**
 * Format timestamp in short IST format without trailing IST suffix
 * Example output: "04 Aug 2026, 03:30 PM"
 */
export const formatShortIST = (timestamp?: number | null): string => {
  if (!timestamp) return 'No Date';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

/**
 * Convert an epoch timestamp to ISO string format suitable for <input type="datetime-local" />
 * in India Standard Time (+05:30).
 * Output format: "YYYY-MM-DDTHH:mm"
 */
export const timestampToISTInputValue = (timestamp?: number | null): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  let hour = map.hour;
  if (hour === '24') hour = '00';

  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
};

/**
 * Parse a datetime-local input string ("YYYY-MM-DDTHH:mm") as India Standard Time (+05:30)
 * and return the UTC epoch timestamp in milliseconds.
 */
export const istInputValueToTimestamp = (inputValue?: string | null): number | null => {
  if (!inputValue || !inputValue.trim()) return null;
  const isoWithOffset = `${inputValue.trim()}:00+05:30`;
  const parsed = Date.parse(isoWithOffset);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Determine exact availability state of an exam based on status and IST start/end timestamps
 */
export const getExamAvailabilityState = (
  exam: { status: string; startTime?: number; endTime?: number },
  now: number = Date.now()
): ExamAvailabilityState => {
  if (exam.status === 'draft') return 'draft';
  if (exam.status === 'archived') return 'archived';

  if (exam.startTime && now < exam.startTime) {
    return 'upcoming';
  }

  if (exam.endTime && now > exam.endTime) {
    return 'expired';
  }

  return 'active';
};

/**
 * Return human-friendly availability info and badge styling for an exam in IST
 */
export const getAvailabilityBadgeInfo = (
  exam: { status: string; startTime?: number; endTime?: number },
  now: number = Date.now()
) => {
  const state = getExamAvailabilityState(exam, now);

  switch (state) {
    case 'draft':
      return {
        state,
        label: 'Draft',
        description: 'Draft - Not Published',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        dotClass: 'bg-amber-500',
        canStudentStart: false,
      };
    case 'archived':
      return {
        state,
        label: 'Archived',
        description: 'Archived Exam',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-300',
        dotClass: 'bg-gray-400',
        canStudentStart: false,
      };
    case 'upcoming':
      return {
        state,
        label: 'Scheduled / Upcoming',
        description: `Starts on ${formatInIST(exam.startTime)}`,
        badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
        dotClass: 'bg-sky-500',
        canStudentStart: false,
      };
    case 'active':
      return {
        state,
        label: 'Active / Live',
        description: exam.endTime
          ? `Available until ${formatInIST(exam.endTime)}`
          : 'Active (No Due Date)',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        dotClass: 'bg-emerald-500 animate-pulse',
        canStudentStart: true,
      };
    case 'expired':
      return {
        state,
        label: 'Expired / Closed',
        description: `Closed on ${formatInIST(exam.endTime)}`,
        badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
        dotClass: 'bg-rose-500',
        canStudentStart: false,
      };
  }
};

/**
 * Get formatted current IST time string for UI header badges
 */
export const getCurrentISTDisplay = (): string => {
  return formatInIST(Date.now());
};
