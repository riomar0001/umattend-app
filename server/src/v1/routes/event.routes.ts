import express from 'express';
import eventController from '../controllers/event.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/role.middleware';
import { checkSchema } from 'express-validator';
import {
  EventValidSchema,
  AddOrganizerValidSchema,
  RemoveOrganizerValidSchema,
} from '../validators/addEventValidSchema';
import { checkOrganizer } from '../middlewares/checkOrganizer.middleware';
const router = express.Router();

router.post(
  '/',
  authMiddleware,
  checkRole('admin', 'csg'),
  checkSchema(EventValidSchema),
  eventController.addEvent
);
router.delete(
  '/:event_id',
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.deleteEvent
);

router.patch(
  '/:event_id/post',
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.postEvent
);

router.patch(
  '/:event_id/draft',
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.draftEvent
);
router.put(
  '/:eventId',
  authMiddleware,
  checkRole('admin', 'csg'),
  checkSchema(EventValidSchema),
  eventController.updateEvent
);
router.post(
  `/check_in/:event_id/:qr_code`,
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.createCheckInEvent
);
router.post(
  `/check_out/:event_id/:qr_code`,
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.createCheckOutEvent
);

router.post(
  `/mass_check_out/:event_id`,
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.massCheckOutEvent
);

router.post(
  `/:event_id/checkin/:student_id`,
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.checkInStudentById
);

router.post(
  `/:event_id/checkout/:student_id`,
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.checkOutStudentById
);

router.post(
  `/add_organizer/:event_id`,
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  checkSchema(AddOrganizerValidSchema),
  eventController.addOrganizer
);

router.delete(
  `/remove_organizer/:event_id`,
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  checkSchema(RemoveOrganizerValidSchema),
  eventController.removeOrganizer
);

router.get('/', authMiddleware, eventController.getAllEvents);

router.get('/past', authMiddleware, eventController.getAllPastEvents);

router.get('/:event_id', authMiddleware, eventController.getEventDetailsById);

router.get(
  '/:event_id/attendees',
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.getPaginatedAttendeesByEventId
);

router.get(
  '/:event_id/organizers',
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.getOrganizersByEventId
);

router.get(
  '/export/:event_id',
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.exportEventAttendeesToExcel
);

router.get(
  '/:event_id/attendance_count',
  authMiddleware,
  checkRole('admin', 'csg'),
  checkOrganizer,
  eventController.getEventAttendanceCount
);

export default router;
