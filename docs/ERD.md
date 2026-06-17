erDiagram
  %% School Management System — Entity Relationship Diagram

  %% ─── AUTH & USERS ───────────────────────────────────────────────────────────
  USER {
    string  id           PK
    string  email        UK
    string  passwordHash
    enum    role
    string  firstName
    string  lastName
    string  phone
    enum    gender
    date    dateOfBirth
    string  avatarUrl
    bool    isActive
    bool    isEmailVerified
    string  mfaSecret
    bool    mfaEnabled
    date    lastLoginAt
    date    createdAt
  }

  REFRESH_TOKEN {
    string  id        PK
    string  token     UK
    string  userId    FK
    date    expiresAt
    date    revokedAt
    string  deviceInfo
  }

  AUDIT_LOG {
    string  id         PK
    string  userId     FK
    string  action
    string  resource
    string  resourceId
    json    changes
    string  ipAddress
  }

  %% ─── ACADEMIC STRUCTURE ──────────────────────────────────────────────────────
  ACADEMIC_YEAR {
    string  id        PK
    string  name
    date    startDate
    date    endDate
    bool    isCurrent
  }

  CLASS {
    string  id              PK
    string  name
    int     grade
    string  section
    int     capacity
    string  academicYearId  FK
    string  classTeacherId  FK
  }

  SUBJECT {
    string  id          PK
    string  name
    string  code        UK
    string  description
    int     creditHours
    bool    isElective
  }

  CLASS_SUBJECT {
    string  id        PK
    string  classId   FK
    string  subjectId FK
    string  teacherId FK
  }

  %% ─── PEOPLE ─────────────────────────────────────────────────────────────────
  STUDENT {
    string  id              PK
    string  userId          FK
    string  studentId       UK
    string  classId         FK
    date    admissionDate
    string  bloodGroup
    string  address
    string  guardianName
    string  guardianPhone
    string  medicalNotes
  }

  TEACHER {
    string  id             PK
    string  userId         FK
    string  employeeId     UK
    string  qualification
    string  specialization
    date    joiningDate
    decimal salary
  }

  PARENT {
    string  id         PK
    string  userId     FK
    string  occupation
    string  address
  }

  PARENT_STUDENT {
    string  id        PK
    string  parentId  FK
    string  studentId FK
    string  relation
  }

  %% ─── ATTENDANCE ──────────────────────────────────────────────────────────────
  ATTENDANCE {
    string  id          PK
    string  studentId   FK
    string  classId     FK
    date    date
    enum    status
    string  markedById  FK
    string  note
  }

  %% ─── TIMETABLE ───────────────────────────────────────────────────────────────
  TIMETABLE {
    string  id              PK
    string  academicYearId  FK
    date    effectiveFrom
    date    effectiveTo
    bool    isActive
  }

  TIMETABLE_SLOT {
    string  id           PK
    string  timetableId  FK
    string  classId      FK
    string  subjectId    FK
    string  teacherId    FK
    enum    dayOfWeek
    string  startTime
    string  endTime
    string  roomNumber
  }

  %% ─── EXAMS & GRADES ──────────────────────────────────────────────────────────
  EXAM {
    string  id              PK
    string  name
    enum    type
    string  subjectId       FK
    string  academicYearId  FK
    string  classId         FK
    date    startDate
    date    endDate
    decimal totalMarks
    decimal passingMarks
  }

  GRADE {
    string  id            PK
    string  studentId     FK
    string  examId        FK
    string  subjectId     FK
    decimal marksObtained
    string  grade
    decimal gpa
    string  feedback
  }

  GRADE_SCALE {
    string  id        PK
    string  name
    bool    isDefault
  }

  GRADE_SCALE_ENTRY {
    string  id           PK
    string  scaleId      FK
    string  letterGrade
    decimal minPercent
    decimal maxPercent
    decimal gpaPoints
  }

  %% ─── FEES ───────────────────────────────────────────────────────────────────
  FEE_STRUCTURE {
    string  id              PK
    string  name
    enum    type
    decimal amount
    string  academicYearId  FK
    string  classId         FK
    date    dueDate
    bool    isRecurring
  }

  FEE {
    string  id              PK
    string  studentId       FK
    string  feeStructureId  FK
    string  academicYearId  FK
    enum    type
    string  description
    decimal amount
    date    dueDate
    enum    status
  }

  INVOICE {
    string  id              PK
    string  invoiceNumber   UK
    string  studentId       FK
    string  feeId           FK
    decimal amount
    decimal totalAmount
    enum    status
    date    dueDate
    date    paidAt
    string  stripeSessionId
  }

  PAYMENT {
    string  id            PK
    string  invoiceId     FK
    decimal amount
    enum    method
    string  transactionId
    date    paidAt
  }

  %% ─── LIBRARY ────────────────────────────────────────────────────────────────
  BOOK {
    string  id              PK
    string  isbn            UK
    string  title
    string  author
    string  category
    int     totalCopies
    int     availableCopies
    enum    status
  }

  BOOK_ISSUE {
    string  id          PK
    string  bookId      FK
    string  studentId   FK
    date    issuedAt
    date    dueDate
    date    returnedAt
    decimal fineAmount
  }

  %% ─── TRANSPORT ───────────────────────────────────────────────────────────────
  VEHICLE {
    string  id               PK
    string  registrationNo   UK
    string  model
    int     capacity
    string  driverName
    string  driverPhone
  }

  TRANSPORT_ROUTE {
    string  id          PK
    string  name
    string  vehicleId   FK
    string  startPoint
    string  endPoint
    json    stops
    bool    isActive
  }

  TRANSPORT_ASSIGNMENT {
    string  id        PK
    string  studentId FK
    string  routeId   FK
    enum    type
    string  pickupStop
    string  dropStop
    bool    isActive
  }

  %% ─── ASSIGNMENTS & LMS ───────────────────────────────────────────────────────
  ASSIGNMENT {
    string  id          PK
    string  title
    string  description
    string  subjectId   FK
    string  teacherId   FK
    string  classId     FK
    date    dueDate
    decimal totalMarks
    enum    status
    json    attachments
    bool    allowLate
  }

  SUBMISSION {
    string  id            PK
    string  assignmentId  FK
    string  studentId     FK
    string  content
    json    attachments
    enum    status
    date    submittedAt
    decimal marks
    string  feedback
  }

  COURSE_CONTENT {
    string  id          PK
    string  title
    string  subjectId   FK
    string  classId     FK
    int     order
    string  contentType
    string  contentUrl
    string  embedUrl
    bool    isPublished
  }

  %% ─── MESSAGING ───────────────────────────────────────────────────────────────
  MESSAGE {
    string  id        PK
    string  senderId  FK
    string  subject
    string  body
    enum    type
    string  parentId  FK
  }

  MESSAGE_RECIPIENT {
    string  id        PK
    string  messageId FK
    string  userId    FK
    bool    isRead
    date    readAt
    date    deletedAt
  }

  ANNOUNCEMENT {
    string  id          PK
    string  title
    string  content
    string  authorId    FK
    string  classId     FK
    array   targetRoles
    bool    isPinned
    date    publishAt
    date    expiresAt
  }

  %% ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
  NOTIFICATION {
    string  id       PK
    string  userId   FK
    string  title
    string  body
    string  type
    enum    channel
    json    data
    bool    isRead
  }

  NOTIFICATION_PREFERENCE {
    string  id      PK
    string  userId  FK
    bool    email
    bool    sms
    bool    push
    bool    inApp
  }

  %% ─── RELATIONSHIPS ──────────────────────────────────────────────────────────
  USER ||--o| STUDENT : "has profile"
  USER ||--o| TEACHER : "has profile"
  USER ||--o| PARENT  : "has profile"
  USER ||--o{ REFRESH_TOKEN : "has tokens"
  USER ||--o{ NOTIFICATION  : "receives"
  USER ||--o| NOTIFICATION_PREFERENCE : "has prefs"
  USER ||--o{ AUDIT_LOG     : "generates"
  USER ||--o{ MESSAGE       : "sends"
  USER ||--o{ MESSAGE_RECIPIENT : "receives"
  USER ||--o{ ANNOUNCEMENT  : "authors"

  ACADEMIC_YEAR ||--o{ CLASS    : "contains"
  ACADEMIC_YEAR ||--o{ EXAM     : "has"
  ACADEMIC_YEAR ||--o{ TIMETABLE : "has"

  CLASS ||--o{ STUDENT       : "has"
  CLASS ||--o{ CLASS_SUBJECT : "has"
  CLASS ||--o{ ATTENDANCE    : "tracks"
  CLASS ||--o{ TIMETABLE_SLOT : "has"
  CLASS ||--o| TEACHER       : "homeroom"

  SUBJECT ||--o{ CLASS_SUBJECT  : "taught in"
  SUBJECT ||--o{ ASSIGNMENT     : "has"
  SUBJECT ||--o{ TIMETABLE_SLOT : "scheduled"
  SUBJECT ||--o{ EXAM           : "has"
  SUBJECT ||--o{ GRADE          : "graded for"
  SUBJECT ||--o{ COURSE_CONTENT : "has"

  TEACHER ||--o{ CLASS_SUBJECT  : "teaches"
  TEACHER ||--o{ ATTENDANCE     : "marks"
  TEACHER ||--o{ ASSIGNMENT     : "creates"
  TEACHER ||--o{ TIMETABLE_SLOT : "assigned"

  STUDENT ||--o{ ATTENDANCE    : "has"
  STUDENT ||--o{ GRADE         : "has"
  STUDENT ||--o{ SUBMISSION    : "submits"
  STUDENT ||--o{ BOOK_ISSUE    : "borrows"
  STUDENT ||--o{ FEE           : "has"
  STUDENT ||--o{ INVOICE       : "has"
  STUDENT ||--o{ TRANSPORT_ASSIGNMENT : "has"
  STUDENT ||--o{ PARENT_STUDENT : "has parents"

  PARENT  ||--o{ PARENT_STUDENT : "has children"

  TIMETABLE ||--o{ TIMETABLE_SLOT : "contains"

  EXAM    ||--o{ GRADE : "produces"

  GRADE_SCALE ||--o{ GRADE_SCALE_ENTRY : "has"

  FEE_STRUCTURE ||--o{ FEE     : "generates"
  FEE       ||--o{ INVOICE     : "invoiced as"
  INVOICE   ||--o{ PAYMENT     : "paid via"

  BOOK     ||--o{ BOOK_ISSUE   : "issued as"

  VEHICLE  ||--o{ TRANSPORT_ROUTE : "runs"
  TRANSPORT_ROUTE ||--o{ TRANSPORT_ASSIGNMENT : "has"

  ASSIGNMENT ||--o{ SUBMISSION  : "has"

  MESSAGE  ||--o{ MESSAGE_RECIPIENT : "sent to"
  MESSAGE  ||--o{ MESSAGE : "threaded"
