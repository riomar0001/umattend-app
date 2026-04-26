const refresh = {
  '/auth/refresh': {
    post: {
      tags: ['Authentication'],
      summary: 'Refresh access token',
      description: 'Refresh the access token using a valid refresh token',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                refresh_token: {
                  type: 'string',
                  description:
                    'Refresh token (optional if provided in Authorization header)',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Token refreshed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Access Token Refreshed Successfully',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      access_token: {
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
        400: {
          description: 'Bad request - Refresh token is required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: {
                    type: 'string',
                    example: 'Refresh token is required',
                  },
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized - Token expired or invalid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Token Expire' },
                },
              },
            },
          },
        },
        404: {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Not Found' },
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

const logout = {
  '/auth/logout': {
    post: {
      tags: ['Authentication'],
      summary: 'Logout user',
      description: 'Logout the currently authenticated user',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Logged out successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refresh_token: {
                    type: 'string',
                    description:
                      'Refresh token (optional if provided in Authorization header)',
                  },
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Logged out successfully',
                  },
                  data: { type: 'null' },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request',
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
        401: {
          description: 'Unauthorized - Token expired or authentication error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Token Expire' },
                },
              },
            },
          },
        },
        404: {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Not Found' },
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

const exchange = {
  '/auth/exchange': {
    post: {
      tags: ['Authentication'],
      summary: 'Exchange authorization code',
      description: 'Exchange authorization code for tokens',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              title: 'Error Response',
              properties: {
                auth_code: {
                  type: 'string',
                  description: 'Exchange Auth code',
                },
                error_code: {
                  type: 'string',
                  description: 'Exchange Error code',
                },
              },
              required: ['error_code', 'auth_code'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Code exchanged successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Tokens retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      access_token: {
                        type: 'string',
                        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      },
                      refresh_token: {
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
        400: {
          description: 'Bad request - Missing or invalid exchange code',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Missing exchange code' },
                },
              },
            },
          },
        },
        404: {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Not Found' },
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

const loginHistory = {
  '/auth/login-history': {
    get: {
      tags: ['Authentication'],
      summary: 'Get login history',
      description: 'Retrieve login history for the authenticated user',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Login history retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Login history retrieved',
                  },
                  data: {
                    type: 'object',
                    properties: {
                      login_history: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            ip_address: {
                              type: 'string',
                              example: '203.0.113.42',
                            },
                            browser: { type: 'string', example: 'Chrome' },
                            os: { type: 'string', example: 'Windows' },
                            device: { type: 'string', example: 'Desktop' },
                            city: { type: 'string', example: 'Davao City' },
                            region: { type: 'string', example: 'Davao Region' },
                            country: { type: 'string', example: 'Philippines' },
                            created_at: {
                              type: 'string',
                              format: 'date-time',
                              example: '2025-01-15T10:30:00.000Z',
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

export const auth = {
  ...refresh,
  ...logout,
  ...exchange,
  ...loginHistory,
};
