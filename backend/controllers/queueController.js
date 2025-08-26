const Queue = require('../models/Queue');

const getTickets = async (req, res) => {
  try {
    const tickets = await Queue.find({ userId: req.user.id }).sort({ issuedAt: 1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const issueTicket = async (req, res) => {
  const { number, type, estimatedTime, priority } = req.body;
  try {
    const ticket = await Queue.create({ 
      userId: req.user.id, 
      number, 
      type, 
      estimatedTime, 
      priority: priority || (type === 'priority' ? 1 : 0)
    });
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTicket = async (req, res) => {
  const { status, servedAt, completedAt, noShowAt } = req.body;
  try {
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this ticket' });
    }

    ticket.status = status || ticket.status;
    if (servedAt) ticket.servedAt = new Date(servedAt);
    if (completedAt) ticket.completedAt = new Date(completedAt);
    if (noShowAt) ticket.noShowAt = new Date(noShowAt);

    const updatedTicket = await ticket.save();
    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTicket = async (req, res) => {
  try {
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this ticket' });
    }
    await Queue.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ticket deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCounters = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const regularCount = await Queue.countDocuments({ 
      userId: req.user.id, 
      type: 'regular',
      issuedAt: { $gte: today }
    });
    
    const priorityCount = await Queue.countDocuments({ 
      userId: req.user.id, 
      type: 'priority',
      issuedAt: { $gte: today }
    });

    res.json({
      regular: regularCount + 1001,
      priority: priorityCount + 1
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resetQueue = async (req, res) => {
  try {
    await Queue.deleteMany({ userId: req.user.id });
    res.json({ message: 'Queue reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getTickets, issueTicket, updateTicket, deleteTicket, getCounters, resetQueue };

// queue 4