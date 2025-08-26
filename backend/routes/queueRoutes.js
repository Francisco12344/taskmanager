const express = require('express');
const { getTickets, issueTicket, updateTicket, deleteTicket, getCounters, resetQueue } = require('../controllers/queueController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').get(protect, getTickets).post(protect, issueTicket);
router.route('/counters').get(protect, getCounters);
router.route('/reset').delete(protect, resetQueue);
router.route('/:id').put(protect, updateTicket).delete(protect, deleteTicket);

module.exports = router;

// token 2