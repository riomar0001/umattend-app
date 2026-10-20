import { client } from './client/client.gen';
import type { MassCheckOutResponse } from '@/lib/mass-check-out-results';

export async function massCheckOut(eventId: string, studentIds: number[], confirmEmail: string) {
  const response = await client.post<{ 200: { data: MassCheckOutResponse } }, unknown, true>({
    url: '/event/mass_check_out/{event_id}',
    path: { event_id: eventId },
    body: { student_ids: studentIds, confirm_email: confirmEmail },
    headers: { 'Content-Type': 'application/json' },
    throwOnError: true
  });
  return response.data.data;
}
