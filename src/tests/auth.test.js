// src/tests/auth.test.js
import supertest from 'supertest';
import mongoose from 'mongoose';
import app from '../../index.js'; // Updated to index.js
import User from '../models/User.js';
import Session from '../models/Session.js';
import redisClient from '../config/redis.js';
import { generateToken } from '../utils/auth.js';

const request = supertest(app);

describe('Authentication API', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await redisClient.quit(); // Ensure Redis connection is closed
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Session.deleteMany({});
    await redisClient.flushall();
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user and send verification email', async () => {
      const res = await request.post('/api/auth/signup').send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User created. Please verify your email.');
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).toBeTruthy();
      expect(user.isEmailVerified).toBe(false);
      expect(user.verificationToken).toBeTruthy();
    });

    it('should fail if email already exists', async () => {
      await User.create({
        email: 'test@example.com',
        password: 'hashed',
        profile: { name: 'Test User' },
      });

      const res = await request.post('/api/auth/signup').send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Email already exists');
    });
  });

  describe('GET /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'hashed',
        profile: { name: 'Test User' },
        verificationToken: 'valid-token',
      });

      const res = await request.get('/api/auth/verify-email?token=valid-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Email verified successfully');
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isEmailVerified).toBe(true);
      expect(updatedUser.verificationToken).toBeNull();
    });

    it('should fail with invalid token', async () => {
      const res = await request.get('/api/auth/verify-email?token=invalid-token');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid or expired token');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const hashedPassword = await import('../utils/auth.js').then((m) => m.hashPassword('password123'));
      const user = await User.create({
        email: 'test@example.com',
        password: hashedPassword,
        profile: { name: 'Test User' },
        isEmailVerified: true,
      });

      const res = await request.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user).toMatchObject({ id: user._id.toString(), email: user.email });
      const session = await Session.findOne({ user: user._id });
      expect(session).toBeTruthy();
    });

    it('should fail if email not verified', async () => {
      const hashedPassword = await import('../utils/auth.js').then((m) => m.hashPassword('password123'));
      await User.create({
        email: 'test@example.com',
        password: hashedPassword,
        profile: { name: 'Test User' },
        isEmailVerified: false,
      });

      const res = await request.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Please verify your email');
    });

    it('should fail with invalid credentials', async () => {
      const res = await request.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/google', () => {
    it('should authenticate with Google (mocked)', async () => {
      const res = await request.get('/api/auth/google').set('user-agent', 'test-agent');

      const user = await User.findOne({ email: 'mock.google@test.com' });
      expect(user).toBeTruthy();
      expect(user.googleId).toBe('mock-google-id');
      expect(user.isEmailVerified).toBe(true);
    });
  });

  describe('GET /api/auth/facebook', () => {
    it('should authenticate with Facebook (mocked)', async () => {
      const res = await request.get('/api/auth/facebook').set('user-agent', 'test-agent');

      const user = await User.findOne({ email: 'mock.facebook@test.com' });
      expect(user).toBeTruthy();
      expect(user.facebookId).toBe('mock-facebook-id');
      expect(user.isEmailVerified).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user and blacklist token', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'hashed',
        profile: { name: 'Test User' },
        isEmailVerified: true,
      });
      const token = generateToken(user._id);
      await Session.create({ user: user._id, token, device: 'test-agent', ipAddress: '127.0.0.1' });

      const res = await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
      const session = await Session.findOne({ token });
      expect(session).toBeNull();
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      expect(isBlacklisted).toBe('blacklisted');
    });

    it('should fail without token', async () => {
      const res = await request.post('/api/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    });
  });

  describe('GET /api/auth/sessions', () => {
    it('should list active sessions', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'hashed',
        profile: { name: 'Test User' },
        isEmailVerified: true,
      });
      const token = generateToken(user._id);
      await Session.create({ user: user._id, token, device: 'test-agent', ipAddress: '127.0.0.1' });

      const res = await request
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ device: 'test-agent', ipAddress: '127.0.0.1' });
    });
  });

  describe('DELETE /api/auth/sessions/:sessionId', () => {
    it('should revoke a session', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'hashed',
        profile: { name: 'Test User' },
        isEmailVerified: true,
      });
      const token = generateToken(user._id);
      const session = await Session.create({
        user: user._id,
        token,
        device: 'test-agent',
        ipAddress: '127.0.0.1',
      });

      const res = await request
        .delete(`/api/auth/sessions/${session._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Session revoked');
      const deletedSession = await Session.findById(session._id);
      expect(deletedSession).toBeNull();
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      expect(isBlacklisted).toBe('blacklisted');
    });

    it('should fail for invalid session ID', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'hashed',
        profile: { name: 'Test User' },
        isEmailVerified: true,
      });
      const token = generateToken(user._id);

      const res = await request
        .delete('/api/auth/sessions/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Session not found');
    });
  });
});