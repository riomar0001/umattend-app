/**
 * Utility functions for event-related operations
 */
import type { ApiEventData, ExtendedEventCardData, EventStatus, AttendanceStatus } from '@/types/events';
import { formatDateVeryShort, formatDayOfWeek, formatTime } from '@/lib/utils';

/**
 * Transform API event data to EventCardData format
 * @param apiEvent - Event data from API
 * @returns Transformed event data with computed fields
 */
export const transformEventData = (apiEvent: ApiEventData): ExtendedEventCardData => {
  const startDate = apiEvent.start_time ? new Date(apiEvent.start_time) : new Date();
  const endDate = apiEvent.end_time ? new Date(apiEvent.end_time) : new Date();

  const attendees = apiEvent.check_out_required ? apiEvent.checkout_count || 0 : apiEvent.checkin_count || 0;

  return {
    id: apiEvent.id ? parseInt(apiEvent.id) : undefined,
    apiId: apiEvent.id || '',
    title: apiEvent.title || 'Untitled Event',
    description: apiEvent.description,
    date: formatDateVeryShort(startDate),
    dayOfWeek: formatDayOfWeek(startDate),
    startTime: apiEvent.all_day ? 'All Day' : formatTime(startDate),
    endTime: apiEvent.all_day ? '' : formatTime(endDate),
    location: apiEvent.location,
    hasLocation: !!apiEvent.location,
    attendees: attendees,
    category: apiEvent.department,
    eventStatus: getEventStatus(apiEvent),
    can_edit: apiEvent.can_edit || false,
    check_out_required: apiEvent.check_out_required,
    checkin_count: apiEvent.checkin_count,
    checkout_count: apiEvent.checkout_count,
    is_draft: apiEvent.is_draft,
  };
};

/**
 * Determine event status based on timestamps and flags
 * @param event - Event data with timestamps
 * @returns Event status (upcoming, ongoing, or completed)
 */
export const getEventStatus = (event: ApiEventData): EventStatus => {
  if (event.is_done) return 'completed';

  const now = new Date();
  const startTime = event.start_time ? new Date(event.start_time) : null;
  const endTime = event.end_time ? new Date(event.end_time) : null;

  if (!startTime || !endTime) return 'upcoming';

  if (now < startTime) return 'upcoming';
  if (now >= startTime && now <= endTime) return 'ongoing';
  if (now > endTime) return 'completed';

  return 'upcoming';
};

/**
 * Determine user's attendance status based on check-in/check-out data
 * @param event - Event data with user_attendance information
 * @returns Attendance status
 */
export const getAttendanceStatus = (event: ApiEventData): AttendanceStatus => {
  if (!event.user_attendance) return 'did_not_attend';

  const { check_in_at, check_out_at } = event.user_attendance;
  const checkoutRequired = event.check_out_required;

  // If checkout is required
  if (checkoutRequired) {
    if (check_in_at && check_out_at) return 'attended';
    if (check_in_at && !check_out_at) return 'partially_attended';
    return 'did_not_attend';
  }

  // If checkout is not required
  if (check_in_at) return 'attended';
  return 'did_not_attend';
};

/**
 * Get Tailwind CSS classes for event status badge
 * @param status - Event status
 * @returns Tailwind CSS class string
 */
export const getStatusColor = (status: EventStatus): string => {
  switch (status) {
    case 'upcoming':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'ongoing':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'completed':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

/**
 * Get status badge configuration with label and color
 * @param status - Event status
 * @returns Object with label and className for status badge
 */
export const getStatusBadgeConfig = (status: EventStatus) => {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const className = getStatusColor(status);
  const showPulse = status === 'ongoing';

  return { label, className, showPulse };
};
