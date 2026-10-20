import { client } from './client/client.gen';

export interface MassCheckInResult {
  student_id: string;
  status: 'checked_in' | 'skipped' | 'failed';
  message: string;
}

export async function massCheckIn(eventId: string, studentIds: string[]) {
  const response = await client.post<{ 200: { data: { results: MassCheckInResult[] } } }, unknown, true>({
    url: '/event/mass_check_in/{event_id}',
    path: { event_id: eventId },
    body: { student_ids: studentIds },
    headers: { 'Content-Type': 'application/json' },
    throwOnError: true
  });
  return response.data.data.results;
}
