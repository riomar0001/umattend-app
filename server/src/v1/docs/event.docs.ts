const updateAndDeleteEvent = {
  '/event/{event_id}': {
    delete: {
      tags: ['Event'],
      summary: 'Delete event',
      description:
        'Delete an existing event by ID (Admin/CSG/Organizer only). Requires typing the event name on the frontend to confirm.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event to delete.',
        },
      ],
      responses: {
        200: {
          description: 'Event deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Event successfully deleted',
                  },
                  data: { type: 'null' },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - Event ID is required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event ID is required' },
                },
              },
            },
          },
        },
        401: {
          description:
            'Unauthorized - authentication required to delete an event',
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
        403: {
          description: 'Forbidden - only Admin/CSG roles can delete events',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        404: {
          description:
            'Event not found - the specified event ID does not exist',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event not found' },
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
      tags: ['Event'],
      summary: 'Update event',
      description: 'Update an existing event by ID (Admin/CSG only).',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event to update.',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 140,
                  default: 'Updated Annual Tech Conference 2025',
                  description: 'Event title',
                },
                description: {
                  type: 'string',
                  minLength: 20,
                  maxLength: 500,
                  default:
                    'Updated Join us for an exciting day of technology talks, networking, and learning from industry experts.',
                  description: 'Event description',
                },
                department: {
                  type: 'string',
                  minLength: 3,
                  default: 'Updated College of Computer Studies',
                  description: 'College/Department',
                },
                location: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 140,
                  default: 'Updated Main Auditorium, Building A',
                  description: 'Event location',
                },
                capacity: {
                  type: 'integer',
                  default: 100,
                  description: 'Updated Event capacity',
                },
                all_day: {
                  type: 'boolean',
                  default: false,
                  description: 'All day event flag',
                },
                start_time: {
                  type: 'string',
                  format: 'date-time',
                  default: '2025-10-15T09:00:00Z',
                  example: '2025-10-15T09:00:00.000Z',
                  description: 'Event start time (ISO 8601 format)',
                },
                end_time: {
                  type: 'string',
                  format: 'date-time',
                  default: '2025-10-15T17:00:00Z',
                  example: '2025-10-15T17:00:00.000Z',
                  description: 'Event end time (ISO 8601 format)',
                },
                check_out_required: {
                  type: 'boolean',
                  default: false,
                  description: 'Check out required flag',
                },
                is_done: {
                  type: 'boolean',
                  default: false,
                  description: 'Event completion status',
                },
                form_fields: {
                  type: 'array',
                  minItems: 1,
                  default: [
                    {
                      field_name: 'Dietary Restrictions',
                      fieldType: 'short_text',
                    },
                    {
                      field_name: 'T-Shirt Size',
                      fieldType: 'dropdown',
                    },
                  ],
                  items: {
                    type: 'object',
                    properties: {
                      field_name: {
                        type: 'string',
                        minLength: 1,
                        maxLength: 140,
                        default: 'Sample Field',
                        description: 'Form field name',
                      },
                      fieldType: {
                        type: 'string',
                        enum: [
                          'dropdown',
                          'short_text',
                          'long_text',
                          'checkbox',
                          'radio',
                        ],
                        default: 'short_text',
                        description: 'Form field type',
                      },
                    },
                    required: ['field_name', 'fieldType'],
                  },
                  description: 'Custom form fields',
                },
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
          description: 'Event updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Event successfully updated',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      department: { type: 'string' },
                      location: { type: 'string' },
                      capacity: {
                        oneOf: [{ type: 'number' }, { type: 'null' }],
                      },
                      all_day: { type: 'boolean' },
                      start_time: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T09:00:00.000Z',
                      },
                      end_time: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T17:00:00.000Z',
                      },
                      check_out_required: { type: 'boolean' },
                      is_done: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - invalid or missing update fields',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event ID is required' },
                },
              },
            },
          },
        },
        401: {
          description:
            'Unauthorized - authentication required to update an event',
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
        403: {
          description: 'Forbidden - only Admin/CSG roles can update events',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        404: {
          description: 'Event not found - cannot update a non-existent event',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event not found' },
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
    get: {
      tags: ['Event'],
      summary: 'Get event details by ID',
      description:
        'Retrieve detailed information about a specific event including check-in/check-out counts and edit permissions',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event',
        },
      ],
      responses: {
        200: {
          description: 'Event details retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Event details retrieved',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      id: {
                        type: 'string',
                        example: '123e4567-e89b-12d3-a456-426614174000',
                      },
                      title: {
                        type: 'string',
                        example: 'Annual Tech Conference 2025',
                      },
                      description: {
                        type: 'string',
                        example:
                          'Join us for an exciting day of technology talks, networking, and learning from industry experts.',
                      },
                      department: {
                        type: 'string',
                        example: 'College of Computer Studies',
                      },
                      location: {
                        type: 'string',
                        example: 'Main Auditorium, Building A',
                      },
                      capacity: {
                        oneOf: [{ type: 'number' }, { type: 'null' }],
                        example: 100,
                        description: 'Maximum event capacity',
                      },
                      all_day: {
                        type: 'boolean',
                        example: false,
                        description: 'Whether the event is an all-day event',
                      },
                      start_time: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T09:00:00.000Z',
                        description: 'Event start time',
                      },
                      end_time: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T17:00:00.000Z',
                        description: 'Event end time',
                      },
                      check_out_required: {
                        type: 'boolean',
                        example: true,
                        description:
                          'Whether check-out is required for the event',
                      },
                      is_done: {
                        type: 'boolean',
                        example: false,
                        description: 'Whether the event is marked as completed',
                      },
                      is_draft: {
                        type: 'boolean',
                        example: false,
                        description:
                          'Whether the event is a draft (hidden from regular users)',
                      },
                      checkin_count: {
                        type: 'number',
                        example: 45,
                        description: 'Number of attendees who have checked in',
                      },
                      checkout_count: {
                        type: 'number',
                        example: 40,
                        description:
                          'Number of attendees who have checked out (only if check_out_required is true)',
                      },
                      created_by: {
                        type: 'string',
                        example: '123e4567-e89b-12d3-a456-426614174001',
                        description: 'User ID of the event creator',
                      },
                      can_edit: {
                        type: 'boolean',
                        example: true,
                        description:
                          'Whether the current user has permission to edit this event',
                      },
                      user_attendance: {
                        type: 'object',
                        description:
                          "The current user's attendance information for this event",
                        properties: {
                          check_in_at: {
                            type: ['string', 'null'],
                            format: 'date-time',
                            example: '2025-10-15T09:15:00.000Z',
                            description:
                              'When the user checked in to the event, or null if not checked in',
                          },
                          check_out_at: {
                            type: ['string', 'null'],
                            format: 'date-time',
                            example: '2025-10-15T16:45:00.000Z',
                            description:
                              'When the user checked out from the event, or null if not checked out',
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
        400: {
          description: 'Bad request - Event ID is required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event ID is required' },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized - authentication required',
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
          description: 'Event not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event not found' },
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

const checkIn = {
  '/event/check_in/{event_id}/{qr_code}': {
    post: {
      tags: ['Event'],
      summary: 'Check in user',
      description:
        'Check in a user to an event (Admin/CSG/Organizer only). The controller expects a QR code path parameter which will be decoded to obtain the student_id.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'Event ID',
        },
        {
          in: 'path',
          name: 'qr_code',
          required: true,
          schema: { type: 'string' },
          description:
            'QR code token (required). The server will decode and verify it to obtain the student_id.',
        },
      ],
      responses: {
        200: {
          description: 'User checked in successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Check-in successful' },
                  data: {
                    type: 'object',
                    properties: {
                      event_id: { type: 'string' },
                      event_name: { type: 'string' },
                      checked_in_at: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T09:30:00.000Z',
                      },
                      checked_in_by: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - Missing required fields',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'student_id and event_id are required',
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
        403: {
          description: 'Forbidden - User has not completed onboarding',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'User has not completed onboarding',
                  },
                },
              },
            },
          },
        },
        404: {
          description: 'User or event not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        409: {
          description: 'Student is already checked in to this event',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Student is already checked in to this event',
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

const checkOut = {
  '/event/check_out/{event_id}/{qr_code}': {
    post: {
      tags: ['Event'],
      summary: 'Check out user',
      description:
        'Check out a user from an event (Admin/CSG/Organizer only). The controller expects a QR code path parameter which will be decoded to obtain the student_id.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'Event ID',
        },
        {
          in: 'path',
          name: 'qr_code',
          required: true,
          schema: { type: 'string' },
          description:
            'QR code token (required). The server will decode and verify it to obtain the student_id.',
        },
      ],
      responses: {
        200: {
          description: 'User checked out successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Check-out successful' },
                  data: {
                    type: 'object',
                    properties: {
                      event_id: { type: 'string' },
                      event_name: { type: 'string' },
                      checked_out_at: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T17:30:00.000Z',
                      },
                      checked_out_by: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - Missing required fields',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'student_id and event_id are required',
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
        403: {
          description: 'Forbidden - User has not completed onboarding',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'User has not completed onboarding',
                  },
                },
              },
            },
          },
        },
        404: {
          description: 'User or event not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        409: {
          description:
            'Student has already checked out, or student has already checked out of this event',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Student has already checked out of this event',
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

const addOrganizer = {
  '/event/add_organizer/{event_id}': {
    post: {
      tags: ['Event'],
      summary: 'Add organizer',
      description: 'Add an organizer to an event (Admin/CSG/Organizer only)',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
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
                umindanao_email: {
                  type: 'string',
                  description: 'umindanao email of the organizer to add',
                },
              },
              required: ['umindanao_email'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Organizer added successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Organizer added successfully',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      user_id: { type: 'string' },
                      event_id: { type: 'string' },
                      added_by: { type: 'string' },
                      created_at: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T08:00:00.000Z',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description:
            'Bad request - Missing required fields or validation errors',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event ID is required' },
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
        403: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Access denied' },
                },
              },
            },
          },
        },
        404: {
          description: 'Event or user not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string' },
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

const removeOrganizer = {
  '/event/remove_organizer/{event_id}': {
    delete: {
      tags: ['Event'],
      summary: 'Remove organizer',
      description:
        'Remove an organizer from an event (Admin/CSG/Organizer only). The event creator cannot be removed.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
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
                umindanao_email: {
                  type: 'string',
                  description: 'umindanao email of the organizer to remove',
                },
              },
              required: ['umindanao_email'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Organizer removed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Organizer removed successfully',
                  },
                  data: { type: 'null' },
                },
              },
            },
          },
        },
        400: {
          description:
            'Bad request - Missing required fields or validation errors',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event ID is required' },
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
        403: {
          description:
            'Forbidden - Cannot remove event creator or insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Cannot remove the event creator as an organizer',
                  },
                },
              },
            },
          },
        },
        404: {
          description: 'Event, user, or organizer record not found',
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

const createAndGetEvent = {
  '/event': {
    post: {
      tags: ['Event'],
      summary: 'Create event',
      description: 'Create a new event (Admin/CSG only)',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 140,
                  default: 'Annual Tech Conference 2025',
                  description: 'Event title',
                },
                description: {
                  type: 'string',
                  minLength: 20,
                  maxLength: 500,
                  default:
                    'Join us for an exciting day of technology talks, networking, and learning from industry experts.',
                  description: 'Event description',
                },
                department: {
                  type: 'string',
                  minLength: 3,
                  default: 'College of Computer Studies',
                  description: 'College/Department',
                },
                location: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 140,
                  default: 'Main Auditorium, Building A',
                  description: 'Event location',
                },
                capacity: {
                  type: 'integer',
                  default: 100,
                  description: 'Event capacity',
                  nullable: true,
                },
                all_day: {
                  type: 'boolean',
                  default: false,
                  description: 'All day event flag',
                },
                start_time: {
                  type: 'string',
                  format: 'date-time',
                  default: '2025-10-15T09:00:00Z',
                  example: '2025-10-15T09:00:00.000Z',
                  description: 'Event start time (ISO 8601 format)',
                },
                end_time: {
                  type: 'string',
                  format: 'date-time',
                  default: '2025-10-15T17:00:00Z',
                  example: '2025-10-15T17:00:00.000Z',
                  description: 'Event end time (ISO 8601 format)',
                },
                check_out_required: {
                  type: 'boolean',
                  default: false,
                  description: 'Check out required flag',
                },
                is_done: {
                  type: 'boolean',
                  default: false,
                  description: 'Event completion status',
                },
                form_fields: {
                  type: 'array',
                  minItems: 1,
                  default: [
                    {
                      field_name: 'Dietary Restrictions',
                      fieldType: 'short_text',
                    },
                    {
                      field_name: 'T-Shirt Size',
                      fieldType: 'dropdown',
                    },
                  ],
                  items: {
                    type: 'object',
                    properties: {
                      field_name: {
                        type: 'string',
                        minLength: 1,
                        maxLength: 140,
                        default: 'Sample Field',
                        description: 'Form field name',
                      },
                      fieldType: {
                        type: 'string',
                        enum: [
                          'dropdown',
                          'short_text',
                          'long_text',
                          'checkbox',
                          'radio',
                        ],
                        default: 'short_text',
                        description: 'Form field type',
                      },
                    },
                    required: ['field_name', 'fieldType'],
                  },
                  description: 'Custom form fields',
                },
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
          description: 'Event created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Event Created' },
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      department: { type: 'string' },
                      location: { type: 'string' },
                      capacity: {
                        oneOf: [{ type: 'number' }, { type: 'null' }],
                      },
                      all_day: { type: 'boolean' },
                      start_time: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T09:00:00.000Z',
                      },
                      end_time: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T17:00:00.000Z',
                      },
                      check_out_required: { type: 'boolean' },
                      is_done: { type: 'boolean' },
                      created_by: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - Validation errors',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'array', items: { type: 'object' } },
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
        403: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Access denied' },
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
    get: {
      tags: ['Event'],
      summary: 'Get all events',
      description: 'Retrieve all active (ongoing) events ordered by start time',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Events retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Events retrieved successfully',
                  },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                          example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        title: {
                          type: 'string',
                          example: 'Annual Tech Conference 2025',
                        },
                        description: {
                          type: 'string',
                          example:
                            'Join us for an exciting day of technology talks and networking.',
                        },
                        department: {
                          type: 'string',
                          example: 'College of Computer Studies',
                        },
                        location: {
                          type: 'string',
                          example: 'Main Auditorium, Building A',
                        },
                        capacity: {
                          oneOf: [{ type: 'number' }, { type: 'null' }],
                          example: 100,
                        },
                        all_day: { type: 'boolean', example: false },
                        start_time: {
                          type: 'string',
                          format: 'date-time',
                          example: '2025-10-15T09:00:00.000Z',
                        },
                        end_time: {
                          type: 'string',
                          format: 'date-time',
                          example: '2025-10-15T17:00:00.000Z',
                        },
                        check_out_required: { type: 'boolean', example: true },
                        is_started: { type: 'boolean', example: false },
                        is_draft: { type: 'boolean', example: false },
                        created_by: {
                          type: 'string',
                          example: '123e4567-e89b-12d3-a456-426614174001',
                        },
                        checkin_count: {
                          type: 'number',
                          example: 25,
                        },
                        checkout_count: {
                          type: 'number',
                          example: 20,
                        },
                        can_edit: {
                          type: 'boolean',
                          example: false,
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
          description: 'Unauthorized - authentication required',
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
          description: 'No events found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'No events found' },
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

const getAllPastEvents = {
  '/event/past': {
    get: {
      tags: ['Event'],
      summary: 'Get all past events',
      description: 'Retrieve all past (completed) events ordered by start time',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Events retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Events retrieved successfully',
                  },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                          example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        title: {
                          type: 'string',
                          example: 'Annual Tech Conference 2025',
                        },
                        description: {
                          type: 'string',
                          example:
                            'Join us for an exciting day of technology talks and networking.',
                        },
                        department: {
                          type: 'string',
                          example: 'College of Computer Studies',
                        },
                        location: {
                          type: 'string',
                          example: 'Main Auditorium, Building A',
                        },
                        capacity: {
                          oneOf: [{ type: 'number' }, { type: 'null' }],
                          example: 100,
                        },
                        all_day: { type: 'boolean', example: false },
                        start_time: {
                          type: 'string',
                          format: 'date-time',
                          example: '2025-10-15T09:00:00.000Z',
                        },
                        end_time: {
                          type: 'string',
                          format: 'date-time',
                          example: '2025-10-15T17:00:00.000Z',
                        },
                        check_out_required: { type: 'boolean', example: true },
                        is_done: { type: 'boolean', example: true },
                        created_by: {
                          type: 'string',
                          example: '123e4567-e89b-12d3-a456-426614174001',
                        },
                        checkin_count: {
                          type: 'number',
                          example: 25,
                        },
                        checkout_count: {
                          type: 'number',
                          example: 20,
                        },
                        can_edit: {
                          type: 'boolean',
                          example: false,
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
          description: 'Unauthorized - authentication required',
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
          description: 'No events found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'No events found' },
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

const getPaginatedAttendeesByEventId = {
  '/event/{event_id}/attendees': {
    get: {
      tags: ['Event'],
      summary: 'Get paginated attendees by event ID',
      description:
        'Retrieve a paginated list of attendees for a specific event, including check-in/check-out details and pagination metadata. Supports search by name, student ID, or email.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event',
        },
        {
          in: 'query',
          name: 'page',
          required: false,
          schema: { type: 'integer', example: 1, minimum: 1 },
          description: 'Page number for pagination (default: 1)',
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: { type: 'integer', example: 10, minimum: 1 },
          description: 'Number of attendees per page (default: 10)',
        },
        {
          in: 'query',
          name: 'search',
          required: false,
          schema: { type: 'string', example: 'John' },
          description:
            'Search term to filter attendees by name, student ID, or email (case-insensitive)',
        },
      ],
      responses: {
        200: {
          description: 'Attendees retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Attendees retrieved successfully',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            student: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example:
                                    '123e4567-e89b-12d3-a456-426614174002',
                                },
                                user_id: {
                                  type: 'string',
                                  example:
                                    '123e4567-e89b-12d3-a456-426614174003',
                                },
                                student_id: {
                                  type: 'number',
                                  example: 2023001,
                                },
                                name: { type: 'string', example: 'Jane Doe' },
                                umindanao_email: {
                                  type: ['string', 'null'],
                                  example: 'jane.doe@umindanao.edu.ph',
                                  description:
                                    'May be null if user email not set',
                                },
                                department: {
                                  type: 'string',
                                  example: 'College of Computer Studies',
                                },
                                program: {
                                  type: 'string',
                                  example:
                                    'Bachelor of Science in Computer Science',
                                },
                                profile_picture: {
                                  type: 'string',
                                  example: 'https://example.com/profile.jpg',
                                },
                                created_at: {
                                  type: 'string',
                                  format: 'date-time',
                                  example: '2025-09-01T08:00:00.000Z',
                                },
                                updated_at: {
                                  type: 'string',
                                  format: 'date-time',
                                  example: '2025-09-01T08:00:00.000Z',
                                },
                                check_in_at: {
                                  type: ['string', 'null'],
                                  format: 'date-time',
                                  example: '2025-10-15T09:15:00.000Z',
                                  description:
                                    'Null if student has not checked in',
                                },
                                check_out_at: {
                                  type: ['string', 'null'],
                                  format: 'date-time',
                                  example: null,
                                  description:
                                    'Null if student has not checked out',
                                },
                                check_in_by: {
                                  type: ['string', 'null'],
                                  example: 'John Admin',
                                  description:
                                    'Name of admin who checked in student',
                                },
                                check_out_by: {
                                  type: ['string', 'null'],
                                  example: null,
                                  description:
                                    'Name of admin who checked out student',
                                },
                              },
                            },
                          },
                        },
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer', example: 1 },
                          limit: { type: 'integer', example: 10 },
                          total: { type: 'integer', example: 47 },
                          totalPages: { type: 'integer', example: 5 },
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
          description: 'Invalid request or missing parameters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Validation error' },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized - authentication required',
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
        403: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Access denied' },
                },
              },
            },
          },
        },
        404: {
          description: 'Event not found or no attendees found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Event not found or no attendees for this event',
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

const getOrganizersByEventId = {
  '/event/{event_id}/organizers': {
    get: {
      tags: ['Event'],
      summary: 'Get event organizers',
      description:
        'Retrieve the list of organizers for a specific event (Admin/CSG/Organizer only).',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event',
        },
      ],
      responses: {
        200: {
          description: 'Organizers retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Organizers retrieved successfully',
                  },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        student_id: {
                          type: ['number', 'null'],
                          example: 2023001,
                          description: 'Student ID number',
                        },
                        name: {
                          type: 'string',
                          example: 'John Doe',
                          description: 'Organizer full name',
                        },
                        department: {
                          type: 'string',
                          example: 'College of Computer Studies',
                          description: 'Department/College',
                        },
                        program: {
                          type: 'string',
                          example: 'Bachelor of Science in Computer Science',
                          description: 'Program/Course',
                        },
                        umindanao_email: {
                          type: 'string',
                          example: 'j.doe.202301@umindanao.edu.ph',
                          description: 'UMindanao email address',
                        },
                        added_by: {
                          type: 'string',
                          example: 'Jane Admin',
                          description:
                            'Name of the user who added this organizer',
                        },
                        added_at: {
                          type: 'string',
                          format: 'date-time',
                          example: '2025-10-15T08:00:00.000Z',
                          description: 'Date and time when organizer was added',
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
          description: 'Bad request - Event ID is required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event ID is required' },
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
        403: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Access denied' },
                },
              },
            },
          },
        },
        404: {
          description: 'Event not found or no organizers found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'No organizers found for this event',
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

const exportEventAttendeesToExcel = {
  '/event/export/{event_id}': {
    get: {
      tags: ['Event'],
      summary: 'Export event attendees',
      description:
        'Export the list of attendees for a specific event to an Excel file `xlsx` (Admin/CSG/Organizer only).',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event',
        },
      ],
      responses: {
        200: {
          description: 'Excel file generated successfully',
          content: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
              {
                schema: {
                  type: 'string',
                  format: 'binary',
                  description: 'Binary Excel file content',
                },
              },
          },
        },
        400: {
          description: 'Bad request - Event ID is required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event ID is required' },
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
        403: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'Access Denied' },
                },
              },
            },
          },
        },
        404: {
          description:
            'Event not found - the specified event ID does not exist',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Event not found' },
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

const getEventAttendanceCount = {
  '/event/{event_id}/attendance_count': {
    get: {
      summary: 'Get event attendance count',
      description:
        'Returns the total number of attendees and total checked-out attendees for a specific event.\n\n- Requires authentication.\n- Only accessible by users with roles: **admin** or **csg**.\n- Organizer permission check is enforced.',
      tags: ['Event'],
      operationId: 'getEventAttendanceCount',
      security: [
        {
          bearerAuth: [],
        },
      ],
      parameters: [
        {
          name: 'event_id',
          in: 'path',
          required: true,
          description: 'The unique identifier of the event.',
          schema: {
            type: 'string',
            example: '',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Event attendance count retrieved successfully.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    example: 'success',
                  },
                  message: {
                    type: 'string',
                    example: 'Event attendance count retrieved successfully',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      totalAttendance: {
                        type: 'integer',
                        description:
                          'Total number of attendees who have checked in.',
                        example: 150,
                      },
                      totalCheckedOut: {
                        type: 'integer',
                        description:
                          'Total number of attendees who have checked out.',
                        example: 120,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'Missing event ID parameter.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    example: 'error',
                  },
                  message: {
                    type: 'string',
                    example: 'Event ID is required.',
                  },
                },
              },
            },
          },
        },
        '404': {
          description: 'Event not found.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    example: 'error',
                  },
                  message: {
                    type: 'string',
                    example: 'Event not found.',
                  },
                },
              },
            },
          },
        },
        '500': {
          description: 'Internal server error.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    example: 'error',
                  },
                  message: {
                    type: 'string',
                    example: 'Internal server error.',
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

const postAndDraftEvent = {
  '/event/{event_id}/post': {
    patch: {
      tags: ['Event'],
      summary: 'Post event',
      description:
        'Publish a draft event so it becomes visible to all users (Admin/CSG/Organizer only).',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event to post.',
        },
      ],
      responses: {
        200: {
          description: 'Event posted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Event posted successfully',
                  },
                  data: { type: 'null' },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        404: { description: 'Event not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
  '/event/{event_id}/draft': {
    patch: {
      tags: ['Event'],
      summary: 'Save event as draft',
      description:
        'Unpost an event (save as draft), hiding it from regular users (Admin/CSG/Organizer only).',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event to save as draft.',
        },
      ],
      responses: {
        200: {
          description: 'Event saved as draft',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Event saved as draft' },
                  data: { type: 'null' },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        404: { description: 'Event not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const massCheckOut = {
  '/event/mass_check_out/{event_id}': {
    post: {
      tags: ['Event'],
      summary: 'Mass check-out students',
      description: 'Check out one or more students from an event by their student IDs (Admin/CSG/Organizer only).',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event.',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['student_ids'],
              properties: {
                student_ids: {
                  type: 'array',
                  items: { type: 'integer' },
                  description: 'Array of student IDs to check out.',
                  example: [20230001, 20230002],
                },
                checkout_time: {
                  type: 'string',
                  description: 'Optional checkout time in HH:MM (Philippines time) or ISO 8601 format.',
                  example: '14:30',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Mass check-out completed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Mass check-out completed' },
                  data: {
                    type: 'object',
                    properties: {
                      updatedCount: { type: 'integer', example: 1 },
                      alreadyCheckedOut: {
                        type: 'array',
                        items: { type: 'integer' },
                        description: 'Student IDs that were already checked out.',
                      },
                      notCheckedIn: {
                        type: 'array',
                        items: { type: 'integer' },
                        description: 'Student IDs that had not checked in.',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Bad request — student_ids array is required' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin/CSG/Organizer only' },
        404: { description: 'Event not found' },
        500: { description: 'Internal server error' },
      },
    },
  },
};

const checkoutStudentById = {
  '/event/{event_id}/checkout/{student_id}': {
    post: {
      tags: ['Event'],
      summary: 'Check out student by student ID',
      description:
        'Manually check out a specific student from an event by their numeric student ID (Admin/CSG/Organizer only). No QR code is required — intended for use from the Attendance Records management table.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'event_id',
          required: true,
          schema: { type: 'string' },
          description: 'The unique ID of the event.',
        },
        {
          in: 'path',
          name: 'student_id',
          required: true,
          schema: { type: 'integer' },
          description: 'The numeric student ID to check out.',
          example: 20230001,
        },
      ],
      responses: {
        200: {
          description: 'Student checked out successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Check-out successful' },
                  data: {
                    type: 'object',
                    properties: {
                      event_id: { type: 'string' },
                      event_name: { type: 'string' },
                      student_id: { type: 'integer', example: 20230001 },
                      student_name: { type: 'string' },
                      checked_out_at: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-10-15T17:30:00.000Z',
                      },
                      checked_out_by: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request — student has not checked in, or event_id / student_id missing',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — Admin/CSG/Organizer only, or onboarding not complete' },
        404: { description: 'Event or student not found' },
        409: {
          description: 'Student has already checked out of this event',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Student has already checked out of this event',
                  },
                },
              },
            },
          },
        },
        500: { description: 'Internal server error' },
      },
    },
  },
};

export const event = {
  ...createAndGetEvent,
  ...updateAndDeleteEvent,
  ...checkIn,
  ...checkOut,
  ...addOrganizer,
  ...removeOrganizer,
  ...getAllPastEvents,
  ...getPaginatedAttendeesByEventId,
  ...getOrganizersByEventId,
  ...exportEventAttendeesToExcel,
  ...getEventAttendanceCount,
  ...postAndDraftEvent,
  ...massCheckOut,
  ...checkoutStudentById,
};
