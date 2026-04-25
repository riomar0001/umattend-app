import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import {
  HTTPErrorResponse,
  HTTPSuccessResponse,
} from '@/utils/responseHandler';
import { AddEventRequest } from '../interface/event';
import { matchedData, validationResult } from 'express-validator';
import eventServices from '../services/event.service';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from '@/utils/customErrors';
import { formatDateTime, generateExportFileName } from '@/utils/export.utils';
import { NODE_ENV } from '@/constants/app.constants';
import { decodeAndVerifyQR } from '@/utils/decodeAndVerifyQR';

const addEvent = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }

    const data = matchedData(req);

    const { id: created_by, umindanao_email } = req.user;

    const {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done,
    } = data as AddEventRequest['body']['event_data'];

    const event_data = {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done,
      created_by,
    };

    if (!event_data) {
      return HTTPErrorResponse(res, 400, 'Missing event_data in request body');
    }

    if (!umindanao_email) {
      return HTTPErrorResponse(res, 401, 'Unauthorized');
    }

    // Validate that end time is not before start time
    if (event_data.end_time < event_data.start_time) {
      return HTTPErrorResponse(
        res,
        400,
        'End time cannot be before start time'
      );
    }

    const new_event = await eventServices.addEvent(event_data);

    if (!umindanao_email) {
      return HTTPErrorResponse(res, 500, 'Failed to add event');
    }

    return HTTPSuccessResponse(res, 200, 'Event Created', new_event);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Error: ', error);
    }
    if (NODE_ENV === 'DEVELOPMENT') {
      console.log('Unexpected error adding event:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const deleteEvent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { eventId } = req.params;
    const created_by = req.user?.id;

    if (!eventId) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }

    await eventServices.deleteEvent(eventId, created_by);

    return HTTPSuccessResponse(res, 200, 'Event successfully deleted');
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }

    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error deleting event:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const updateEvent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }

    const data = matchedData(req);

    const { id: created_by } = req.user;

    const {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done,
    } = data as AddEventRequest['body']['event_data'];

    const updated_event_data = {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done,
      created_by,
    };

    const { eventId } = req.params;

    if (!eventId) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }

    const updated_event = await eventServices.updateEvent(
      eventId,
      updated_event_data
    );

    return HTTPSuccessResponse(
      res,
      200,
      'Event successfully updated',
      updated_event
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }

    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error updating event:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const createCheckInEvent = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { qr_code, event_id } = req.params;

    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'event_id is required');
    }

    if (!qr_code) {
      return HTTPErrorResponse(res, 400, 'Invalid QR Code');
    }
    let student_id: number = 0;
    if (qr_code) {
      try {
        const { valid, student_id: qrStudentId } = decodeAndVerifyQR(qr_code);

        if (!valid || !qrStudentId) {
          return HTTPErrorResponse(res, 400, 'Invalid or expired QR code');
        }

        student_id = Number(qrStudentId);
      } catch {
        return HTTPErrorResponse(res, 400, 'Invalid or expired QR code');
      }
    }

    const { umindanao_email, done_onboarding } = req.user;

    if (!done_onboarding) {
      throw new ForbiddenError('User has not completed onboarding');
    }

    const check_in_data = {
      student_id: student_id,
      event_id: event_id,
      check_in_by: req.user.id,
      check_in_at: new Date().toISOString(),
    };

    if (!check_in_data) {
      return HTTPErrorResponse(
        res,
        400,
        'Missing check_in_data in request body'
      );
    }

    const checkIn = await eventServices.createCheckInEvent(check_in_data);

    if (!umindanao_email) {
      return HTTPErrorResponse(res, 401, 'Unauthorized');
    }

    if (!checkIn) {
      return HTTPErrorResponse(res, 500, 'Failed to create check-in record');
    }

    const responseData = {
      event_id: checkIn.event_id,
      event_name: checkIn.event.title,
      checked_in_at: checkIn.check_in_at,
      checked_in_by: checkIn.check_in_by,
    };

    return HTTPSuccessResponse(res, 200, 'Check-in successful', responseData);
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      return HTTPErrorResponse(res, 409, error.message);
    }
    if (error instanceof BadRequestError) {
      return HTTPErrorResponse(res, 400, error.message);
    }
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error checking in', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const createCheckOutEvent = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { qr_code, event_id } = req.params;

    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'event_id is required');
    }

    if (!qr_code) {
      return HTTPErrorResponse(res, 400, 'Invalid QR Code');
    }

    let student_id: number = 0;

    if (!student_id && qr_code) {
      try {
        const { valid, student_id: qrStudentId } = decodeAndVerifyQR(qr_code);

        if (!valid || !qrStudentId) {
          return HTTPErrorResponse(res, 400, 'Invalid or expired QR code');
        }

        student_id = Number(qrStudentId);
      } catch {
        return HTTPErrorResponse(res, 400, 'Invalid or expired QR code');
      }
    }

    const { umindanao_email, done_onboarding } = req.user;

    if (!done_onboarding) {
      throw new ForbiddenError('User has not completed onboarding');
    }

    const check_out_data = {
      student_id: student_id,
      event_id: event_id,
      check_out_by: req.user.id,
      check_out_at: new Date().toISOString(),
    };

    if (!check_out_data) {
      return HTTPErrorResponse(
        res,
        400,
        'Missing check_out_data in request body'
      );
    }

    const checkOut = await eventServices.createCheckOutEvent(check_out_data);

    if (!umindanao_email) {
      return HTTPErrorResponse(res, 401, 'Unauthorized');
    }

    if (!checkOut) {
      return HTTPErrorResponse(res, 500, 'Failed to create check-out record');
    }

    const responseData = {
      event_id: checkOut.event_id,
      event_name: checkOut.event.title,
      checked_out_at: checkOut.check_out_at,
      checked_out_by: checkOut.check_out_by,
    };

    return HTTPSuccessResponse(res, 200, 'Check-out successful', responseData);
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      return HTTPErrorResponse(res, 409, error.message);
    }
    if (error instanceof BadRequestError) {
      return HTTPErrorResponse(res, 400, error.message);
    }
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error checking out', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const massCheckOutEvent = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { event_id } = req.params;

    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'event_id is required');
    }

    const { student_ids, checkout_time } = req.body as {
      student_ids?: number[];
      checkout_time?: string;
    };

    if (
      !student_ids ||
      !Array.isArray(student_ids) ||
      student_ids.length === 0
    ) {
      return HTTPErrorResponse(
        res,
        400,
        'student_ids array is required in the request body'
      );
    }

    const { umindanao_email, done_onboarding } = req.user;

    if (!done_onboarding) {
      throw new ForbiddenError('User has not completed onboarding');
    }

    const result = await eventServices.massCheckOutStudents(
      event_id,
      student_ids,
      req.user.id,
      checkout_time
    );

    if (!umindanao_email) {
      return HTTPErrorResponse(res, 401, 'Unauthorized');
    }

    return HTTPSuccessResponse(res, 200, 'Mass check-out completed', result);
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error mass checking out', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const addOrganizer = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    const { id: added_by } = req.user;

    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }

    const data = matchedData(req);

    const { umindanao_email, event_id } = data as {
      umindanao_email: string;
      event_id: string;
    };

    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }
    if (!umindanao_email) {
      return HTTPErrorResponse(res, 400, 'Umindanao email is required');
    }
    const new_organizer = await eventServices.addOrganizer(
      umindanao_email,
      event_id,
      added_by
    );
    return HTTPSuccessResponse(
      res,
      200,
      'Organizer added successfully',
      new_organizer
    );
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error adding organizer:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const removeOrganizer = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }

    const data = matchedData(req);

    const { umindanao_email, event_id } = data as {
      umindanao_email: string;
      event_id: string;
    };

    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }
    if (!umindanao_email) {
      return HTTPErrorResponse(res, 400, 'Umindanao email is required');
    }

    await eventServices.removeOrganizer(umindanao_email, event_id);

    return HTTPSuccessResponse(
      res,
      200,
      'Organizer removed successfully',
      null
    );
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error removing organizer:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getEventDetailsById = async (req: Request, res: Response) => {
  try {
    const { event_id } = req.params;
    const user_id = req.user?.id;

    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }

    if (!user_id) {
      return HTTPErrorResponse(res, 401, 'Unauthorized');
    }

    const event = await eventServices.getEventDetailsById(event_id, user_id);
    return HTTPSuccessResponse(res, 200, 'Event details retrieved', event);
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error retrieving event details:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getOrganizersByEventId = async (req: Request, res: Response) => {
  try {
    const { event_id } = req.params;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }
    const organizers = await eventServices.getOrganizersByEventId(event_id);
    return HTTPSuccessResponse(
      res,
      200,
      'Organizers retrieved successfully',
      organizers
    );
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error retrieving organizers:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getAllEvents = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.id;

    if (!user_id) {
      return HTTPErrorResponse(res, 401, 'Unauthorized');
    }

    const events = await eventServices.getAllEvents(user_id);
    return HTTPSuccessResponse(
      res,
      200,
      'Events retrieved successfully',
      events
    );
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error retrieving events:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getAllPastEvents = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.id;

    if (!user_id) {
      return HTTPErrorResponse(res, 401, 'Unauthorized');
    }

    const events = await eventServices.getAllPastEvents(user_id);
    return HTTPSuccessResponse(
      res,
      200,
      'Past events retrieved successfully',
      events
    );
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error retrieving events:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getPaginatedAttendeesByEventId = async (req: Request, res: Response) => {
  try {
    const { event_id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }

    const { data, pagination } =
      await eventServices.getPaginatedAttendeesByEventId(
        event_id,
        page,
        limit,
        search
      );

    return HTTPSuccessResponse(res, 200, 'Attendees retrieved successfully', {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
    });
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error retrieving attendees:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const exportEventAttendeesToExcel = async (req: Request, res: Response) => {
  try {
    const { event_id } = req.params;

    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }

    const attendees = await eventServices.getAttendeesByEventId(event_id);
    const event_name = await eventServices.getEventNameById(event_id);

    if (attendees.length === 0) {
      return HTTPErrorResponse(res, 404, 'No attendees found for this event');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendees');

    worksheet.columns = [
      { header: 'Student ID', key: 'student_id', width: 10 },
      { header: 'Full Name', key: 'full_name', width: 30 },
      { header: 'Department', key: 'department', width: 30 },
      { header: 'Program', key: 'program', width: 35 },
      { header: 'Email', key: 'umindanao_email', width: 35 },
      { header: 'Check-In By', key: 'check_in_by', width: 30 },
      { header: 'Check-In Time', key: 'check_in_at', width: 25 },
      { header: 'Check-Out By', key: 'check_out_by', width: 30 },
      { header: 'Check-Out Time', key: 'check_out_at', width: 25 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    attendees.forEach((attendee) => {
      worksheet.addRow({
        student_id: attendee.student.student_id,
        full_name: attendee.student.name,
        department: attendee.student.department,
        program: attendee.student.program,
        umindanao_email: attendee.student.umindanao_email,
        check_in_by: attendee.student.check_in_by,
        check_in_at: formatDateTime(attendee.student.check_in_at),
        check_out_by: attendee.student.check_out_by,
        check_out_at: formatDateTime(attendee.student.check_out_at),
      });
    });

    const fileName = generateExportFileName(event_id, event_name);

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    return res.send(buffer);
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      console.error('Unexpected error exporting event attendees:', error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getEventAttendanceCount = async (req: Request, res: Response) => {
  try {
    const { event_id } = req.params;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }
    const { totalAttendance, totalCheckedOut } =
      await eventServices.getTotalAttendanceByEventId(event_id);
    return HTTPSuccessResponse(
      res,
      200,
      'Event attendance count retrieved successfully',
      { totalAttendance, totalCheckedOut }
    );
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') {
      console.error(
        'Unexpected error retrieving event attendance count:',
        error
      );
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const eventController = {
  addEvent,
  deleteEvent,
  updateEvent,
  createCheckInEvent,
  createCheckOutEvent,
  massCheckOutEvent,
  addOrganizer,
  removeOrganizer,
  getOrganizersByEventId,
  getEventDetailsById,
  getAllEvents,
  getAllPastEvents,
  getPaginatedAttendeesByEventId,
  exportEventAttendeesToExcel,
  getEventAttendanceCount,
};

export default eventController;
