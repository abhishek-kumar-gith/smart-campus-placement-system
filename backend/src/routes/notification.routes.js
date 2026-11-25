const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const {
  getNotifications,
  markNotificationRead,
  sendBulkNotification,
  sendNotification,
} = require('../controllers/notification.controller');

router.get('/', protect, asyncHandler(getNotifications));
router.patch('/:id/read', protect, asyncHandler(markNotificationRead));
router.post('/bulk', protect, authorize('admin'), asyncHandler(sendBulkNotification));

router.post('/send', protect, authorize('admin'), validate(z.object({
  recipientType: z.enum(['individual-student', 'individual-recruiter', 'multiple-students', 'multiple-recruiters']),
  recipientIds: z.array(z.string()).min(1).max(100),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(2).max(10000),
})), asyncHandler(sendNotification));
module.exports = router;
