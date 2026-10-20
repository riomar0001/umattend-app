export interface CheckOutStudent {
  student_id?: number | null;
  name?: string;
  department?: string | null;
  program?: string | null;
  umindanao_email?: string | null;
  check_in_at?: string | null;
}

export interface MassCheckOutResponse {
  updatedCount?: number;
  alreadyCheckedOut?: number[];
  notCheckedIn?: number[];
  departmentMismatch?: number[];
  updatedRecords?: {
    student_id: number;
    student: CheckOutStudent;
    check_in_at?: string | null;
    check_out_at?: string | null;
    check_out_by_user?: { umindanao_email?: string } | null;
  }[];
}

function csvCell(value: string) {
  // Quoting alone does not prevent spreadsheet software from executing formulas.
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function createMassCheckOutCsv(eventId: string, students: CheckOutStudent[], result: MassCheckOutResponse) {
  const updated = new Map((result.updatedRecords ?? []).map((record) => [record.student_id, record]));
  const alreadyOut = new Set(result.alreadyCheckedOut);
  const notIn = new Set(result.notCheckedIn);
  const wrongDepartment = new Set(result.departmentMismatch);
  const rows = [
    ['Event ID', 'Student ID', 'Name', 'Department', 'Program', 'Email', 'Result', 'Details', 'Check-In Time (UTC)', 'Check-Out Time (UTC)', 'Checked Out By']
  ];
  for (const student of students) {
    if (typeof student.student_id !== 'number') continue;
    const id = student.student_id;
    const record = updated.get(id);
    let status = 'Unconfirmed';
    let details = 'No individual result returned. Refresh attendance to verify.';
    if (wrongDepartment.has(id)) {
      status = 'Skipped';
      details = 'Student department does not match the event';
    } else if (notIn.has(id)) {
      status = 'Skipped';
      details = 'Student has not checked in';
    } else if (alreadyOut.has(id)) {
      status = 'Skipped';
      details = 'Student was already checked out';
    } else if (record?.check_out_at) {
      status = 'Checked out';
      details = 'Checkout confirmed';
    }
    rows.push([
      eventId,
      String(id).padStart(6, '0'),
      student.name ?? record?.student.name ?? '',
      student.department ?? '',
      student.program ?? '',
      student.umindanao_email ?? '',
      status,
      details,
      record?.check_in_at ?? student.check_in_at ?? '',
      record?.check_out_at ?? '',
      record?.check_out_by_user?.umindanao_email ?? ''
    ]);
  }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadCheckOutResults(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
