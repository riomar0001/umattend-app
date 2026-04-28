// ---------------------------------------------------------------------------
// Dead Letter Queue
// ---------------------------------------------------------------------------

const getQueues = {
  '/admin/queues': {
    get: {
      tags: ['Admin'],
      summary: 'List all queues with job counts',
      description:
        'Returns all BullMQ queues (email, start-event, end-event) with their current job counts (waiting, active, delayed, completed, failed). Admin only.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Queues retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Queues retrieved' },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', example: 'email-queue' },
                        counts: {
                          type: 'object',
                          properties: {
                            waiting: { type: 'number', example: 0 },
                            active: { type: 'number', example: 0 },
                            delayed: { type: 'number', example: 0 },
                            completed: { type: 'number', example: 42 },
                            failed: { type: 'number', example: 2 },
                            paused: { type: 'number', example: 0 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const getFailedJobs = {
  '/admin/queues/{queueName}/failed': {
    get: {
      tags: ['Admin'],
      summary: 'Get failed jobs for a queue',
      description:
        'Returns a paginated list of failed jobs for the specified queue. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'queueName',
          required: true,
          schema: {
            type: 'string',
            enum: ['email-queue', 'event-start-status-queue', 'event-end-status-queue'],
          },
          description: 'Queue name',
        },
        {
          in: 'query',
          name: 'page',
          required: false,
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number',
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          description: 'Items per page',
        },
      ],
      responses: {
        200: {
          description: 'Failed jobs retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Failed jobs retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            data: { type: 'object' },
                            failedReason: {
                              oneOf: [{ type: 'string' }, { type: 'null' }],
                            },
                            attemptsMade: { type: 'number' },
                            timestamp: {
                              oneOf: [{ type: 'number' }, { type: 'null' }],
                            },
                            finishedOn: {
                              oneOf: [{ type: 'number' }, { type: 'null' }],
                            },
                            processedOn: {
                              oneOf: [{ type: 'number' }, { type: 'null' }],
                            },
                          },
                        },
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        404: { description: 'Queue not found' },
        500: { description: 'Internal server error' },
      },
    },
    delete: {
      tags: ['Admin'],
      summary: 'Clean all failed jobs',
      description:
        'Removes all failed jobs from the specified queue. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'queueName',
          required: true,
          schema: {
            type: 'string',
            enum: ['email-queue', 'event-start-status-queue', 'event-end-status-queue'],
          },
          description: 'Queue name',
        },
      ],
      responses: {
        200: {
          description: 'Failed jobs cleaned',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Failed jobs cleaned' },
                  data: {
                    type: 'object',
                    properties: {
                      removed: { type: 'number', example: 5 },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        404: { description: 'Queue not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const retryFailedJob = {
  '/admin/queues/{queueName}/failed/{jobId}/retry': {
    post: {
      tags: ['Admin'],
      summary: 'Retry a single failed job',
      description: 'Retries the specified failed job by its ID. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'queueName',
          required: true,
          schema: {
            type: 'string',
            enum: ['email-queue', 'event-start-status-queue', 'event-end-status-queue'],
          },
          description: 'Queue name',
        },
        {
          in: 'path',
          name: 'jobId',
          required: true,
          schema: { type: 'string' },
          description: 'Job ID',
        },
      ],
      responses: {
        200: {
          description: 'Job retried',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Job retried' },
                  data: {
                    type: 'object',
                    properties: {
                      jobId: { type: 'string' },
                      retried: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        404: { description: 'Queue or job not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const deleteFailedJob = {
  '/admin/queues/{queueName}/failed/{jobId}': {
    delete: {
      tags: ['Admin'],
      summary: 'Delete a single failed job',
      description:
        'Removes the specified failed job from the queue permanently. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'queueName',
          required: true,
          schema: {
            type: 'string',
            enum: ['email-queue', 'event-start-status-queue', 'event-end-status-queue'],
          },
          description: 'Queue name',
        },
        {
          in: 'path',
          name: 'jobId',
          required: true,
          schema: { type: 'string' },
          description: 'Job ID',
        },
      ],
      responses: {
        200: {
          description: 'Job removed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Job removed' },
                  data: {
                    type: 'object',
                    properties: {
                      jobId: { type: 'string' },
                      removed: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        404: { description: 'Queue or job not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const retryAllFailedJobs = {
  '/admin/queues/{queueName}/failed/retry-all': {
    post: {
      tags: ['Admin'],
      summary: 'Retry all failed jobs',
      description:
        'Retries all failed jobs in the specified queue. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'queueName',
          required: true,
          schema: {
            type: 'string',
            enum: ['email-queue', 'event-start-status-queue', 'event-end-status-queue'],
          },
          description: 'Queue name',
        },
      ],
      responses: {
        200: {
          description: 'All failed jobs retried',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'All failed jobs retried',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      retried: { type: 'number', example: 3 },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        404: { description: 'Queue not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const getAllUsers = {
  '/admin/users': {
    get: {
      tags: ['Admin'],
      summary: 'List all users',
      description:
        'Returns a paginated list of all non-deleted users, with optional search by email, name, or student ID. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'page',
          required: false,
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number',
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Items per page',
        },
        {
          in: 'query',
          name: 'search',
          required: false,
          schema: { type: 'string' },
          description: 'Search by email, student name, or student ID',
        },
      ],
      responses: {
        200: {
          description: 'Users retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Users retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            umindanao_email: { type: 'string' },
                            role: { type: 'string' },
                            done_onboarding: { type: 'boolean' },
                            last_login_at: {
                              type: 'string',
                              format: 'date-time',
                            },
                            created_at: {
                              type: 'string',
                              format: 'date-time',
                            },
                            updated_at: {
                              type: 'string',
                              format: 'date-time',
                            },
                            student: {
                              type: 'object',
                              properties: {
                                student_id: { type: 'number' },
                                name: { type: 'string' },
                                department: { type: 'string' },
                                program: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const getUserById = {
  '/admin/users/{userId}': {
    get: {
      tags: ['Admin'],
      summary: 'Get user by ID',
      description: 'Returns full user details including student info. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'userId',
          required: true,
          schema: { type: 'string' },
          description: 'User ID',
        },
      ],
      responses: {
        200: {
          description: 'User retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'User retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          umindanao_email: { type: 'string' },
                          role: { type: 'string' },
                          done_onboarding: { type: 'boolean' },
                          created_at: { type: 'string', format: 'date-time' },
                          student: {
                            type: 'object',
                            properties: {
                              student_id: { type: 'number' },
                              name: { type: 'string' },
                              department: { type: 'string' },
                              program: { type: 'string' },
                              profile_picture: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        404: { description: 'User not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const updateUserRole = {
  '/admin/users/{userId}/role': {
    patch: {
      tags: ['Admin'],
      summary: 'Update user role',
      description:
        'Changes the role of the specified user. Valid roles: student, admin, csg, instructor, organizer. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'userId',
          required: true,
          schema: { type: 'string' },
          description: 'User ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                role: {
                  type: 'string',
                  enum: ['student', 'admin', 'csg', 'instructor', 'organizer'],
                  description: 'New role',
                },
              },
              required: ['role'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'User role updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'User role updated' },
                  data: {
                    type: 'object',
                    properties: {
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          umindanao_email: { type: 'string' },
                          role: { type: 'string' },
                          student: {
                            type: 'object',
                            properties: {
                              student_id: { type: 'number' },
                              name: { type: 'string' },
                              department: { type: 'string' },
                              program: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Bad request — invalid role' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        404: { description: 'User not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const deleteUser = {
  '/admin/users/{userId}': {
    delete: {
      tags: ['Admin'],
      summary: 'Soft-delete a user',
      description:
        'Soft-deletes a user by setting their deleted_at timestamp. The user record is preserved but hidden from admin listings. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'userId',
          required: true,
          schema: { type: 'string' },
          description: 'User ID',
        },
      ],
      responses: {
        200: {
          description: 'User soft-deleted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'User soft-deleted' },
                  data: {
                    type: 'object',
                    properties: {
                      userId: { type: 'string' },
                      deleted: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        404: { description: 'User not found' },
        409: { description: 'Conflict — user already deleted' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const getAllEvents = {
  '/admin/events': {
    get: {
      tags: ['Admin'],
      summary: 'List all events',
      description:
        'Returns a paginated list of all events including drafts, with attendance counts and creator info. Admin only.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'page',
          required: false,
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number',
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Items per page',
        },
        {
          in: 'query',
          name: 'search',
          required: false,
          schema: { type: 'string' },
          description: 'Search by event title or description',
        },
      ],
      responses: {
        200: {
          description: 'Events retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Events retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            description: { type: 'string' },
                            department: { type: 'string' },
                            location: { type: 'string' },
                            capacity: { oneOf: [{ type: 'number' }, { type: 'null' }] },
                            all_day: { type: 'boolean' },
                            start_time: {
                              type: 'string',
                              format: 'date-time',
                            },
                            end_time: {
                              type: 'string',
                              format: 'date-time',
                            },
                            check_out_required: { type: 'boolean' },
                            is_started: { type: 'boolean' },
                            is_done: { type: 'boolean' },
                            is_draft: { type: 'boolean' },
                            created_by: { type: 'string' },
                            created_by_name: { type: 'string' },
                            checkin_count: { type: 'number' },
                            checkout_count: { type: 'number' },
                          },
                        },
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const updateEvent = {
  '/admin/events/{eventId}': {
    patch: {
      tags: ['Admin'],
      summary: 'Update event (admin override)',
      description:
        'Updates event details for any event regardless of creator. Admin override bypasses the created_by ownership check.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'eventId',
          required: true,
          schema: { type: 'string' },
          description: 'Event ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string', minLength: 1, maxLength: 140 },
                description: { type: 'string', minLength: 20, maxLength: 2000 },
                department: { type: 'string', minLength: 3 },
                location: { type: 'string', minLength: 3, maxLength: 140 },
                capacity: { type: 'integer', nullable: true },
                all_day: { type: 'boolean' },
                start_time: { type: 'string', format: 'date-time' },
                end_time: { type: 'string', format: 'date-time' },
                check_out_required: { type: 'boolean' },
                is_done: { type: 'boolean' },
              },
              required: [
                'title',
                'description',
                'department',
                'location',
                'start_time',
                'end_time',
              ],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Event updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Event updated' },
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Bad request — validation errors' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin only' },
        404: { description: 'Event not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

export const admin = {
  ...getQueues,
  ...getFailedJobs,
  ...retryFailedJob,
  ...deleteFailedJob,
  ...retryAllFailedJobs,
  ...getAllUsers,
  ...getUserById,
  ...updateUserRole,
  ...deleteUser,
  ...getAllEvents,
  ...updateEvent,
};
