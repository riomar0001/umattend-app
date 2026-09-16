const getAndUpdateUser = {
  '/user': {
    get: {
      tags: ['User'],
      summary: 'Get user by ID',
      description: 'Retrieve user information for the authenticated user',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'User retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'User succesfully fetched',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: 'usr_123e4567' },
                          umindanao_email: {
                            type: 'string',
                            example: 'j.doe.202301@umindanao.edu.ph',
                          },
                          name: {
                            type: ['string', 'null'],
                            example: 'Jane Doe',
                          },
                          role: { type: 'string', example: 'student' },
                          department: {
                            type: ['string', 'null'],
                            example: 'College of Computer Studies',
                          },
                          program: {
                            type: ['string', 'null'],
                            example: 'BS Computer Science',
                          },
                          profile_picture: {
                            type: ['string', 'null'],
                            example: 'https://example.com/avatar.jpg',
                          },
                          done_onboarding: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'No token provided' },
                },
              },
            },
          },
        },
        404: {
          description: 'User not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'User not found' },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Internal server error' },
                },
              },
            },
          },
        },
      },
    },
    put: {
      tags: ['User'],
      summary: 'Update user profile',
      description:
        'Update user profile fields such as department, program and ID number. Every field is optional; whatever is omitted is left as stored.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                department: { type: 'string' },
                program: { type: 'string' },
                student_id: {
                  type: 'integer',
                  description:
                    'ID number, exactly 6 digits. Replaces whatever is on file, so this is how a wrong or missing one gets corrected. Must not already belong to another account.',
                  minimum: 100000,
                  maximum: 999999,
                  example: 576804,
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'User profile updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'User profile updated' },
                  data: {
                    type: 'object',
                    properties: {
                      access_token: {
                        type: 'string',
                        description:
                          'Reissued so the client picks up the new values — student_id in particular is read from the token.',
                        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          umindanao_email: { type: 'string' },
                          name: { type: 'string' },
                          // 3.1 spells nullability as a type union; the older
                          // `nullable: true` is ignored by the generator and
                          // would produce a client type that cannot hold the
                          // null this endpoint really returns.
                          student_id: {
                            type: ['integer', 'null'],
                            example: 576804,
                          },
                          department: { type: 'string' },
                          program: { type: 'string' },
                          done_onboarding: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - no fields to update, or invalid ID number',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'ID number must be exactly 6 digits',
                  },
                },
              },
            },
          },
        },
        409: {
          description: 'ID number already registered to another account',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example:
                      'That ID number is already registered to another account',
                  },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'No token provided' },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Internal server error' },
                },
              },
            },
          },
        },
      },
    },
  },
};

const onboarding = {
  '/user/onboarding': {
    post: {
      tags: ['User'],
      summary: 'Onboard user',
      description: 'Complete user onboarding process',
      security: [{ bearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                department: { type: 'string' },
                program: { type: 'string' },
                student_id: {
                  type: 'integer',
                  description:
                    'Exactly 6 digits. Required only when the account has no ID number on file — i.e. the umindanao.edu.ph address did not contain one. Ignored if an ID is already stored; use PUT /user to change one.',
                  minimum: 100000,
                  maximum: 999999,
                  example: 576804,
                },
              },
              required: ['department', 'program'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'User onboarded successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'User succesfully updated',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      access_token: {
                        type: 'string',
                        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          email: { type: 'string' },
                          name: { type: 'string' },
                          department: { type: 'string' },
                          program: { type: 'string' },
                          done_onboarding: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - Missing or invalid fields',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'ID number is required' },
                },
              },
            },
          },
        },
        409: {
          description: 'ID number already registered to another account',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example:
                      'That ID number is already registered to another account',
                  },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'No token provided' },
                },
              },
            },
          },
        },
        404: {
          description: 'User not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'User not found' },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Internal server error' },
                },
              },
            },
          },
        },
      },
    },
  },
};

const getUserAttendedEvents = {
  '/user/events': {
    get: {
      tags: ['User'],
      summary: 'Get user attended events',
      description:
        'Retrieve all events the user has attended (checked in and checked out)',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'List of attended events retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Attended events fetched successfully',
                  },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                          example: 'evt_12345',
                        },
                        title: {
                          type: 'string',
                          example: 'Orientation Day',
                        },
                        start_time: {
                          type: 'string',
                          format: 'date-time',
                          example: '2025-10-10T08:00:00Z',
                        },
                        end_time: {
                          type: 'string',
                          format: 'date-time',
                          example: '2025-10-10T10:00:00Z',
                        },
                        check_in_at: {
                          type: 'string',
                          format: 'date-time',
                          example: '2025-10-10T07:55:00Z',
                        },
                        check_out_at: {
                          type: 'string',
                          format: 'date-time',
                          example: '2025-10-10T10:05:00Z',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized - No token provided or invalid token',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Unauthorized' },
                },
              },
            },
          },
        },
        404: {
          description: 'No attended events found for the user',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'No attended events found',
                  },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Internal server error',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const getUserAttendedEventsDetailed = {
  '/user/attended-events': {
    get: {
      tags: ['User'],
      summary: 'Get user attended events with details',
      description:
        'Retrieve all events the user has attended with event details including creator name and date/time',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'List of attended events retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Attended events successfully fetched',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      events: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: {
                              type: 'string',
                              example: 'evt_12345',
                            },
                            title: {
                              type: 'string',
                              example: 'Orientation Day',
                            },
                            created_by: {
                              type: 'string',
                              example: 'John Doe',
                            },
                            start_time: {
                              type: 'string',
                              format: 'date-time',
                              example: '2025-10-10T08:00:00Z',
                            },
                            end_time: {
                              type: 'string',
                              format: 'date-time',
                              example: '2025-10-10T10:00:00Z',
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
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Unauthorized' },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Internal server error',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const getUserHostedEvents = {
  '/user/hosted-events': {
    get: {
      tags: ['User'],
      summary: 'Get user hosted events',
      description:
        'Retrieve all events created/hosted by the user with attendee counts',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'List of hosted events retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Hosted events successfully fetched',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      events: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: {
                              type: 'string',
                              example: 'evt_12345',
                            },
                            title: {
                              type: 'string',
                              example: 'Tech Workshop 2025',
                            },
                            created_by: {
                              type: 'string',
                              example: 'Jane Smith',
                            },
                            start_time: {
                              type: 'string',
                              format: 'date-time',
                              example: '2025-10-15T14:00:00Z',
                            },
                            end_time: {
                              type: 'string',
                              format: 'date-time',
                              example: '2025-10-15T17:00:00Z',
                            },
                            attendees: {
                              type: 'number',
                              example: 42,
                              description:
                                'Number of attendees (check-in count or check-out count if check-out is required)',
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
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Unauthorized' },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Internal server error',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const getAttendanceToken = {
  '/user/attendance-token': {
    get: {
      tags: ['User'],
      summary: 'Get attendance QR token',
      description:
        'Returns a signed JWT for use as QR code data during attendance check-in/out',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Attendance token generated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Attendance token generated',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      token: {
                        type: 'string',
                        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'No token provided' },
                },
              },
            },
          },
        },
        404: {
          description: 'Student not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Student profile not found',
                  },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Internal server error' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const user = {
  ...getAndUpdateUser,
  ...onboarding,
  ...getUserAttendedEvents,
  ...getUserAttendedEventsDetailed,
  ...getUserHostedEvents,
  ...getAttendanceToken,
};
