import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../axiosConfig';

const QueueSystemV2 = () => {
  // Authentication State
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });

  // Queue State
  const [tickets, setTickets] = useState([]);
  const [ticketCounter, setTicketCounter] = useState({ regular: 1001, priority: 1 });
  const [activeTicket, setActiveTicket] = useState(null);
  const [selectedType, setSelectedType] = useState('regular');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [serviceSettings] = useState({
    regular: { avgTime: 8, color: 'blue' },
    priority: { avgTime: 5, color: 'purple' }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Backend API calls
  const fetchTickets = useCallback(async () => {
    if (!user) return;
    try {
      const response = await axiosInstance.get('/api/queue', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setTickets(response.data);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    }
  }, [user]);

  const fetchCounters = useCallback(async () => {
    if (!user) return;
    try {
      const response = await axiosInstance.get('/api/queue/counters', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setTicketCounter(response.data);
    } catch (error) {
      console.error('Failed to fetch counters:', error);
    }
  }, [user]);

  // Load tickets and counters when user logs in
  useEffect(() => {
    if (user) {
      fetchTickets();
      fetchCounters();
    }
  }, [user, fetchTickets, fetchCounters]);

  // Authentication Functions
  const handleAuth = async () => {
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await axiosInstance.post(endpoint, authForm);
      
      const userData = {
        id: response.data.user?.id || response.data.id,
        name: response.data.user?.name || authForm.name || 'User',
        email: response.data.user?.email || authForm.email,
        token: response.data.token
      };
      setUser(userData);
      setAuthForm({ email: '', password: '', name: '' });
    } catch (error) {
      alert('Authentication failed: ' + (error.response?.data?.message || error.message));
    }
  };

  const logout = () => {
    setUser(null);
    setTickets([]);
    setActiveTicket(null);
  };

  const issueTicket = async () => {
    const counter = ticketCounter[selectedType];
    
    const newTicketData = {
      number: selectedType === 'priority' ? `P${counter.toString().padStart(2, '0')}` : counter,
      type: selectedType,
      estimatedTime: calculateAdvancedWaitTime(selectedType),
      priority: selectedType === 'priority' ? 1 : 0
    };
    
    try {
      const response = await axiosInstance.post('/api/queue', newTicketData, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      
      setTickets(prev => [...prev, response.data]);
      setTicketCounter(prev => ({
        ...prev,
        [selectedType]: selectedType === 'priority' ? prev.priority + 1 : prev.regular + 1
      }));
    } catch (error) {
      alert('Failed to issue ticket: ' + (error.response?.data?.message || error.message));
    }
  };

  const calculateAdvancedWaitTime = (ticketType) => {
    const currentQueue = tickets.filter(t => t.status === 'waiting');
    
    if (ticketType === 'priority') {
      const priorityAhead = currentQueue.filter(t => t.type === 'priority').length;
      return priorityAhead * serviceSettings.priority.avgTime;
    } else {
      const priorityAhead = currentQueue.filter(t => t.type === 'priority').length;
      const regularAhead = currentQueue.filter(t => t.type === 'regular').length;
      return (priorityAhead * serviceSettings.priority.avgTime) + (regularAhead * serviceSettings.regular.avgTime);
    }
  };

  const callNext = async () => {
    if (activeTicket) return;
    
    const priorityTicket = tickets.find(t => t.type === 'priority' && t.status === 'waiting');
    const nextTicket = priorityTicket || tickets.find(t => t.type === 'regular' && t.status === 'waiting');
    
    if (nextTicket) {
      try {
        await axiosInstance.put(`/api/queue/${nextTicket._id}`, { 
          status: 'serving',
          servedAt: new Date()
        }, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        
        setTickets(prev => prev.map(t => 
          t._id === nextTicket._id 
            ? { ...t, status: 'serving', servedAt: new Date() }
            : t
        ));
        setActiveTicket(nextTicket.number);
      } catch (error) {
        alert('Failed to call next ticket: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const completeService = async () => {
    if (!activeTicket) return;
    
    const ticket = tickets.find(t => t.number === activeTicket);
    if (ticket) {
      try {
        await axiosInstance.put(`/api/queue/${ticket._id}`, { 
          status: 'completed',
          completedAt: new Date()
        }, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        
        setTickets(prev => prev.map(t => 
          t.number === activeTicket 
            ? { ...t, status: 'completed', completedAt: new Date() }
            : t
        ));
        setActiveTicket(null);
      } catch (error) {
        alert('Failed to complete service: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const noShow = async () => {
    if (!activeTicket) return;
    
    const ticket = tickets.find(t => t.number === activeTicket);
    if (ticket) {
      try {
        await axiosInstance.put(`/api/queue/${ticket._id}`, { 
          status: 'no-show',
          noShowAt: new Date()
        }, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        
        setTickets(prev => prev.map(t => 
          t.number === activeTicket 
            ? { ...t, status: 'no-show', noShowAt: new Date() }
            : t
        ));
        setActiveTicket(null);
      } catch (error) {
        alert('Failed to mark no-show: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const resetSystem = async () => {
    try {
      await axiosInstance.delete('/api/queue/reset', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      
      setTickets([]);
      setActiveTicket(null);
      setTicketCounter({ regular: 1001, priority: 1 });
    } catch (error) {
      alert('Failed to reset system: ' + (error.response?.data?.message || error.message));
    }
  };

  const waitingTickets = tickets.filter(t => t.status === 'waiting').sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return new Date(a.issuedAt || a.createdAt) - new Date(b.issuedAt || b.createdAt);
  });
  
  const completedToday = tickets.filter(t => t.status === 'completed');
  const noShowCount = tickets.filter(t => t.status === 'no-show').length;
  const currentlyServing = tickets.find(t => t.number === activeTicket);

  const priorityStats = {
    waiting: tickets.filter(t => t.type === 'priority' && t.status === 'waiting').length,
    completed: tickets.filter(t => t.type === 'priority' && t.status === 'completed').length
  };

  const regularStats = {
    waiting: tickets.filter(t => t.type === 'regular' && t.status === 'waiting').length,
    completed: tickets.filter(t => t.type === 'regular' && t.status === 'completed').length
  };

  const avgWaitTime = waitingTickets.length > 0 
    ? Math.round(waitingTickets.reduce((acc, t) => acc + t.estimatedTime, 0) / waitingTickets.length)
    : 0;

  // Auth Component
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Digital Queue Management System</h1>
            <p className="text-gray-600">
              {authMode === 'login' ? 'Sign in to your account' : 'Create a new account'}
            </p>
          </div>

          <div className="space-y-4">
            {authMode === 'register' && (
              <input
                type="text"
                placeholder="Full Name"
                value={authForm.name}
                onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            )}
            
            <input
              type="email"
              placeholder="Email Address"
              value={authForm.email}
              onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handleAuth}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-blue-600 hover:text-blue-800"
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Digital Queue Management System</h1>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                {currentTime.toLocaleTimeString()}
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <span>Welcome, {user.name}</span>
              <button
                onClick={logout}
                className="text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Enhanced Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div>
              <p className="text-xs font-medium text-purple-500 uppercase">Priority Waiting</p>
              <p className="text-2xl font-bold text-purple-600">{priorityStats.waiting}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div>
              <p className="text-xs font-medium text-blue-500 uppercase">Regular Waiting</p>
              <p className="text-2xl font-bold text-blue-600">{regularStats.waiting}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Serving</p>
              <p className="text-2xl font-bold text-green-600">{activeTicket ? 1 : 0}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Completed</p>
              <p className="text-2xl font-bold text-gray-700">{completedToday.length}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">No Show</p>
              <p className="text-2xl font-bold text-red-600">{noShowCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Avg Wait</p>
              <p className="text-2xl font-bold text-purple-600">{avgWaitTime}m</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket Issuance with Priority Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">
              Issue New Ticket
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="ticketType"
                      value="regular"
                      checked={selectedType === 'regular'}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Regular Service</div>
                      <div className="text-sm text-gray-500">Standard queue • ~{serviceSettings.regular.avgTime} min avg</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="ticketType"
                      value="priority"
                      checked={selectedType === 'priority'}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Priority Service</div>
                      <div className="text-sm text-gray-500">Fast track • ~{serviceSettings.priority.avgTime} min avg</div>
                    </div>
                  </label>
                </div>
              </div>

              <button
                onClick={issueTicket}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  selectedType === 'priority'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                }`}
              >
                {selectedType === 'priority' ? (
                  <>Issue Priority Ticket P{ticketCounter.priority.toString().padStart(2, '0')}</>
                ) : (
                  <>Issue Regular Ticket #{ticketCounter.regular}</>
                )}
              </button>
            </div>
          </div>

          {/* Service Control */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">
              Service Control
            </h2>

            {currentlyServing && (
              <div className={`mb-4 p-4 rounded-lg border ${
                currentlyServing.type === 'priority' 
                  ? 'bg-purple-50 border-purple-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    currentlyServing.type === 'priority' ? 'text-purple-700' : 'text-green-700'
                  }`}>
                    Currently Serving
                  </span>
                </div>
                <div className={`text-2xl font-bold ${
                  currentlyServing.type === 'priority' ? 'text-purple-800' : 'text-green-800'
                }`}>
                  {currentlyServing.number}
                </div>
                <div className={`text-sm ${
                  currentlyServing.type === 'priority' ? 'text-purple-600' : 'text-green-600'
                }`}>
                  {currentlyServing.type === 'priority' ? 'Priority Service' : 'Regular Service'}
                </div>
                <div className={`text-xs mt-1 ${
                  currentlyServing.type === 'priority' ? 'text-purple-500' : 'text-green-500'
                }`}>
                  Started: {currentlyServing.servedAt ? new Date(currentlyServing.servedAt).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={callNext}
                disabled={activeTicket || waitingTickets.length === 0}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Call Next Customer
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={completeService}
                  disabled={!activeTicket}
                  className="bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm transition-colors"
                >
                  Complete
                </button>
                <button
                  onClick={noShow}
                  disabled={!activeTicket}
                  className="bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm transition-colors"
                >
                  No Show
                </button>
              </div>

              <button
                onClick={resetSystem}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                Reset System
              </button>
            </div>
          </div>

          {/* Enhanced Queue Display */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Queue Status</h2>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {waitingTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No customers in queue</p>
                </div>
              ) : (
                waitingTickets.map((ticket, index) => (
                  <div key={ticket._id || ticket.number} className={`flex items-center justify-between p-3 rounded-lg ${
                    ticket.type === 'priority' 
                      ? 'bg-purple-50 border border-purple-200' 
                      : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className={`font-semibold ${
                          ticket.type === 'priority' ? 'text-purple-900' : 'text-gray-900'
                        }`}>
                          {ticket.number}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ticket.type === 'priority' ? 'Priority' : 'Regular'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700">
                        #{index + 1}
                      </div>
                      <div className="text-xs text-gray-500">
                        ~{Math.round(ticket.estimatedTime)}min
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Large Display for Next Customer */}
        {waitingTickets.length > 0 && (
          <div className={`mt-6 rounded-xl shadow-lg p-8 text-center text-white ${
            waitingTickets[0].type === 'priority'
              ? 'bg-gradient-to-r from-purple-600 to-purple-800'
              : 'bg-gradient-to-r from-blue-600 to-blue-800'
          }`}>
            <h3 className="text-xl font-semibold mb-4">
              Next in Queue
            </h3>
            <div className="text-6xl font-bold mb-2">{waitingTickets[0].number}</div>
            <div className="text-lg opacity-90">
              {waitingTickets[0].type === 'priority' ? 'Priority Service' : 'Regular Service'}
            </div>
            <div className="text-sm opacity-75 mt-2">
              Estimated wait: {Math.round(waitingTickets[0].estimatedTime)} minutes
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueSystemV2;