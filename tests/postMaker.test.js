/* eslint-disable no-unused-vars */
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const app = express();
const postRoutes = require('../routers/post');
const {pool} = require('../controllers/pools');
const {createPost} = require('../controllers/post');

app.use(express.json());
app.use(cors());
app.use('/', postRoutes);

console.error = jest.fn(); // Mock console.error

jest.mock('../controllers/pools', () => ({
  pool: {
    query: jest.fn().mockReturnValue(true),
  },
}));

describe('createPost', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return 400 if required fields are missing', async () => {
    const req = {
      userId: '',
      header: '',
      description: '',
      visibility: 'University',
      interestid: 1,
    };
    const res = await request(app).post('/api/createPosts').send(req);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('All fields are required.');
  });

  test('should return 500 if database interaction fails', async () => {
    const req = {
      userId: 'should not be string',
      header: 'Header',
      description: 'Description',
      visibility: 'University',
      interestid: 1,
    };
    const res = await request(app).post('/api/createPosts').send(req);
    expect(res.status).toBe(500);
  });
});
