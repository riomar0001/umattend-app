import { Request } from 'express';

export interface AddEventInterface {
  title: string;
  description: string;
  department: string;
  location: string;
  capacity?: number;
  all_day: boolean;
  start_time: Date;
  end_time: Date;
  check_out_required: boolean;
  is_done: boolean;
  is_draft?: boolean;
  form_fields?: {};
  created_by: string;
}

export interface UpdateEventInterface {
  title?: string;
  description?: string;
  department?: string;
  location?: string;
  capacity?: number;
  all_day?: boolean;
  start_time?: Date;
  end_time?: Date;
  check_out_required?: boolean;
  is_done?: boolean;
  form_fields?: {};
  created_by?: string;
}

export interface AddCheckInInterface {
  student_id: number;
  event_id: string;
  check_in_at: string;
  check_in_by: string;
}

export interface AddCheckOutInterface {
  student_id: number;
  event_id: string;
  check_out_at: string;
  check_out_by: string;
}

export interface AddEventRequest extends Request {
  body: {
    event_data: AddEventInterface;
  };
}

export interface GetEventDetailsByIdInterface {
  id: string;
  title: string;
  description: string;
  department: string;
  location: string;
  capacity?: number;
  all_day: boolean;
  start_time?: Date;
  end_time?: Date;
  check_out_required: boolean;
  is_done?: boolean;
  is_started?: boolean;
  is_draft?: boolean;
  checkin_count: number;
  checkout_count?: number;
  created_by: string;
  can_edit: boolean;
  user_attendance?: {
    check_in_at: Date | null;
    check_out_at: Date | null;
  };
}

export interface GetEventDetailsWithEditByIdInterface
  extends GetEventDetailsByIdInterface {}

export interface GetAllEventsInterface
  extends Array<GetEventDetailsByIdInterface> {}
