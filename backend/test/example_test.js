const chai = require('chai');
const chaiHttp = require('chai-http');
const http = require('http');
const app = require('../server'); 
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const sinon = require('sinon');
const Task = require('../models/Task');
const { updateTask,getTasks,addTask,deleteTask } = require('../controllers/taskController');
const { expect } = chai;

chai.use(chaiHttp);
let server;
let port;
let sandbox;


describe('AddTask Function Test', () => {

  it('should create a new task successfully', async () => {
    // Mock request data
    const req = {
      user: { id: new mongoose.Types.ObjectId() },
      body: { title: "New Task", description: "Task description", deadline: "2025-12-31" }
    };

    // Mock task that would be created
    const createdTask = { _id: new mongoose.Types.ObjectId(), ...req.body, userId: req.user.id };

    // Stub Task.create to return the createdTask
    const createStub = sinon.stub(Task, 'create').resolves(createdTask);

    // Mock response object
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };

    // Call function
    await addTask(req, res);

    // Assertions
    expect(createStub.calledOnceWith({ userId: req.user.id, ...req.body })).to.be.true;
    expect(res.status.calledWith(201)).to.be.true;
    expect(res.json.calledWith(createdTask)).to.be.true;

    // Restore stubbed methods
    createStub.restore();
  });

  it('should return 500 if an error occurs', async () => {
    // Stub Task.create to throw an error
    const createStub = sinon.stub(Task, 'create').throws(new Error('DB Error'));

    // Mock request data
    const req = {
      user: { id: new mongoose.Types.ObjectId() },
      body: { title: "New Task", description: "Task description", deadline: "2025-12-31" }
    };

    // Mock response object
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };

    // Call function
    await addTask(req, res);

    // Assertions
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.json.calledWithMatch({ message: 'DB Error' })).to.be.true;

    // Restore stubbed methods
    createStub.restore();
  });

});


describe('Update Function Test', () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should update task successfully', async () => {
    // Mock task data
    const taskId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const existingTask = {
      _id: taskId,
      userId: userId,
      title: "Old Task",
      description: "Old Description",
      completed: false,
      deadline: new Date(),
      save: sinon.stub().resolvesThis(), // Mock save method
    };
    
    // Stub Task.findById to return mock task
    const findByIdStub = sandbox.stub(Task, 'findById').resolves(existingTask);

    // Mock request & response
    const req = {
      params: { id: taskId },
      body: { title: "New Task", completed: true },
      user: { id: userId.toString() }
    };
    const res = {
      json: sinon.spy(), 
      status: sinon.stub().returnsThis()
    };

    // Call function
    await updateTask(req, res);

    // Assertions
    expect(existingTask.title).to.equal("New Task");
    expect(existingTask.completed).to.equal(true);
    expect(res.status.called).to.be.false; // No error status should be set
    expect(res.json.calledOnce).to.be.true;
  });



  it('should return 404 if task is not found', async () => {
    const findByIdStub = sandbox.stub(Task, 'findById').resolves(null);

    const req = { 
      params: { id: new mongoose.Types.ObjectId() }, 
      body: {},
      user: { id: new mongoose.Types.ObjectId().toString() }
    };
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };

    await updateTask(req, res);

    expect(res.status.calledWith(404)).to.be.true;
    expect(res.json.calledWith({ message: 'Task not found' })).to.be.true;
  });

  it('should return 500 on error', async () => {
    const findByIdStub = sandbox.stub(Task, 'findById').throws(new Error('DB Error'));

    const req = { 
      params: { id: new mongoose.Types.ObjectId() }, 
      body: {},
      user: { id: new mongoose.Types.ObjectId().toString() }
    };
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };

    await updateTask(req, res);

    expect(res.status.calledWith(500)).to.be.true;
    expect(res.json.called).to.be.true;
  });



});



describe('GetTask Function Test', () => {

  it('should return tasks for the given user', async () => {
    // Mock user ID
    const userId = new mongoose.Types.ObjectId();

    // Mock task data
    const tasks = [
      { _id: new mongoose.Types.ObjectId(), title: "Task 1", userId },
      { _id: new mongoose.Types.ObjectId(), title: "Task 2", userId }
    ];

    // Stub Task.find to return mock tasks
    const findStub = sinon.stub(Task, 'find').resolves(tasks);

    // Mock request & response
    const req = { user: { id: userId } };
    const res = {
      json: sinon.spy(),
      status: sinon.stub().returnsThis()
    };

    // Call function
    await getTasks(req, res);

    // Assertions
    expect(findStub.calledOnceWith({ userId })).to.be.true;
    expect(res.json.calledWith(tasks)).to.be.true;
    expect(res.status.called).to.be.false; // No error status should be set

    // Restore stubbed methods
    findStub.restore();
  });

  it('should return 500 on error', async () => {
    // Stub Task.find to throw an error
    const findStub = sinon.stub(Task, 'find').throws(new Error('DB Error'));

    // Mock request & response
    const req = { user: { id: new mongoose.Types.ObjectId() } };
    const res = {
      json: sinon.spy(),
      status: sinon.stub().returnsThis()
    };

    // Call function
    await getTasks(req, res);

    // Assertions
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.json.calledWithMatch({ message: 'DB Error' })).to.be.true;

    // Restore stubbed methods
    findStub.restore();
  });

});



describe('DeleteTask Function Test', () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should delete a task successfully', async () => {
    const taskId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    
    // Mock request data
    const req = { 
      params: { id: taskId.toString() },
      user: { id: userId.toString() }
    };

    // Mock task found in the database
    const task = { 
      _id: taskId,
      userId: userId,
      remove: sinon.stub().resolves() 
    };

    // Stub Task methods
    const findByIdStub = sandbox.stub(Task, 'findById').resolves(task);
    const findByIdAndDeleteStub = sandbox.stub(Task, 'findByIdAndDelete').resolves();

    // Mock response object
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };

    // Call function
    await deleteTask(req, res);

    // Assertions
    expect(findByIdStub.calledOnceWith(req.params.id)).to.be.true;
    expect(findByIdAndDeleteStub.calledOnceWith(req.params.id)).to.be.true;
    expect(res.json.calledWith({ message: 'Task deleted' })).to.be.true;
  });

  it('should return 404 if task is not found', async () => {
    // Stub Task.findById to return null
    const findByIdStub = sandbox.stub(Task, 'findById').resolves(null);

    // Mock request data
    const req = { 
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { id: new mongoose.Types.ObjectId().toString() }
    };

    // Mock response object
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };

    // Call function
    await deleteTask(req, res);

    // Assertions
    expect(findByIdStub.calledOnceWith(req.params.id)).to.be.true;
    expect(res.status.calledWith(404)).to.be.true;
    expect(res.json.calledWith({ message: 'Task not found' })).to.be.true;
  });

  it('should return 500 if an error occurs', async () => {
    // Stub Task.findById to throw an error
    const findByIdStub = sandbox.stub(Task, 'findById').throws(new Error('DB Error'));

    // Mock request data
    const req = { 
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { id: new mongoose.Types.ObjectId().toString() }
    };

    // Mock response object
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };

    // Call function
    await deleteTask(req, res);

    // Assertions
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.json.calledWithMatch({ message: 'DB Error' })).to.be.true;
  });

});

//test2