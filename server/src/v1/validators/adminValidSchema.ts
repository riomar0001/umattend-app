export const UpdateRoleValidSchema = {
  role: {
    notEmpty: { errorMessage: 'Role is required' },
    isIn: {
      options: [['student', 'admin', 'csg', 'instructor', 'organizer']],
      errorMessage:
        'Role must be one of: student, admin, csg, instructor, organizer',
    },
  },
};

export const PaginationSchema = {
  page: {
    optional: true,
    isInt: { options: { min: 1 }, errorMessage: 'Page must be a positive integer' },
    toInt: true,
  },
  limit: {
    optional: true,
    isInt: { options: { min: 1, max: 100 }, errorMessage: 'Limit must be between 1 and 100' },
    toInt: true,
  },
};
