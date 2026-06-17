import { PrismaClient, Role, Gender, FeeType, DayOfWeek } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ─── 1. Academic Year ─────────────────────────────
  const academicYear = await prisma.academicYear.upsert({
    where: { id: "ay-2024-2025" },
    update: {},
    create: {
      id: "ay-2024-2025",
      name: "2024-2025",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-06-30"),
      isCurrent: true,
    },
  });
  console.log("✅ Academic year created");

  // ─── 2. Grade Scale ───────────────────────────────
  const scale = await prisma.gradeScale.create({
    data: {
      name: "Standard A-F (GPA 4.0)",
      isDefault: true,
      grades: {
        create: [
          { letterGrade: "A+", minPercent: 97, maxPercent: 100, gpaPoints: 4.0 },
          { letterGrade: "A", minPercent: 93, maxPercent: 96.99, gpaPoints: 4.0 },
          { letterGrade: "A-", minPercent: 90, maxPercent: 92.99, gpaPoints: 3.7 },
          { letterGrade: "B+", minPercent: 87, maxPercent: 89.99, gpaPoints: 3.3 },
          { letterGrade: "B", minPercent: 83, maxPercent: 86.99, gpaPoints: 3.0 },
          { letterGrade: "B-", minPercent: 80, maxPercent: 82.99, gpaPoints: 2.7 },
          { letterGrade: "C+", minPercent: 77, maxPercent: 79.99, gpaPoints: 2.3 },
          { letterGrade: "C", minPercent: 73, maxPercent: 76.99, gpaPoints: 2.0 },
          { letterGrade: "C-", minPercent: 70, maxPercent: 72.99, gpaPoints: 1.7 },
          { letterGrade: "D", minPercent: 60, maxPercent: 69.99, gpaPoints: 1.0 },
          { letterGrade: "F", minPercent: 0, maxPercent: 59.99, gpaPoints: 0.0 },
        ],
      },
    },
  });
  console.log("✅ Grade scale created");

  // ─── 3. Admin User ────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@school.edu" },
    update: {},
    create: {
      email: "admin@school.edu",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      firstName: "System",
      lastName: "Administrator",
      gender: Gender.MALE,
      isEmailVerified: true,
    },
  });
  console.log("✅ Admin user created: admin@school.edu / Admin@123");

  // ─── 4. Subjects ──────────────────────────────────
  const subjects = await Promise.all([
    prisma.subject.upsert({ where: { code: "MATH-101" }, update: {}, create: { name: "Mathematics", code: "MATH-101", creditHours: 4 } }),
    prisma.subject.upsert({ where: { code: "ENG-101" }, update: {}, create: { name: "English Language", code: "ENG-101", creditHours: 4 } }),
    prisma.subject.upsert({ where: { code: "SCI-101" }, update: {}, create: { name: "General Science", code: "SCI-101", creditHours: 4 } }),
    prisma.subject.upsert({ where: { code: "HIST-101" }, update: {}, create: { name: "History", code: "HIST-101", creditHours: 3 } }),
    prisma.subject.upsert({ where: { code: "GEO-101" }, update: {}, create: { name: "Geography", code: "GEO-101", creditHours: 3 } }),
    prisma.subject.upsert({ where: { code: "PHY-101" }, update: {}, create: { name: "Physics", code: "PHY-101", creditHours: 4 } }),
    prisma.subject.upsert({ where: { code: "CHEM-101" }, update: {}, create: { name: "Chemistry", code: "CHEM-101", creditHours: 4 } }),
    prisma.subject.upsert({ where: { code: "CS-101" }, update: {}, create: { name: "Computer Science", code: "CS-101", creditHours: 3 } }),
    prisma.subject.upsert({ where: { code: "PE-101" }, update: {}, create: { name: "Physical Education", code: "PE-101", creditHours: 2 } }),
    prisma.subject.upsert({ where: { code: "ART-101" }, update: {}, create: { name: "Art & Design", code: "ART-101", creditHours: 2, isElective: true } }),
  ]);
  console.log("✅ Subjects created:", subjects.length);

  // ─── 5. Teachers ──────────────────────────────────
  const teacherPw = await bcrypt.hash("Teacher@123", 12);
  const teacherData = [
    { email: "john.smith@school.edu", firstName: "John", lastName: "Smith", employeeId: "TCH-001" },
    { email: "sarah.jones@school.edu", firstName: "Sarah", lastName: "Jones", employeeId: "TCH-002" },
    { email: "michael.brown@school.edu", firstName: "Michael", lastName: "Brown", employeeId: "TCH-003" },
    { email: "emily.davis@school.edu", firstName: "Emily", lastName: "Davis", employeeId: "TCH-004" },
  ];

  const teachers = await Promise.all(
    teacherData.map(async (t) => {
      const user = await prisma.user.upsert({
        where: { email: t.email },
        update: {},
        create: {
          email: t.email,
          passwordHash: teacherPw,
          role: Role.TEACHER,
          firstName: t.firstName,
          lastName: t.lastName,
          isEmailVerified: true,
        },
      });
      return prisma.teacher.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          employeeId: t.employeeId,
          qualification: "M.Ed",
          joiningDate: new Date("2020-09-01"),
        },
      });
    })
  );
  console.log("✅ Teachers created:", teachers.length);

  // ─── 6. Classes ───────────────────────────────────
  const classData = [
    { name: "Grade 10A", grade: 10, section: "A" },
    { name: "Grade 10B", grade: 10, section: "B" },
    { name: "Grade 11A", grade: 11, section: "A" },
    { name: "Grade 12A", grade: 12, section: "A" },
  ];

  const classes = await Promise.all(
    classData.map((c, i) =>
      prisma.class.upsert({
        where: { grade_section_academicYearId: { grade: c.grade, section: c.section, academicYearId: academicYear.id } },
        update: {},
        create: {
          name: c.name,
          grade: c.grade,
          section: c.section,
          capacity: 35,
          academicYearId: academicYear.id,
          classTeacherId: teachers[i % teachers.length].id,
        },
      })
    )
  );
  console.log("✅ Classes created:", classes.length);

  // ─── 7. Class-Subject Assignments ─────────────────
  const classSubjectMap = [
    { classIdx: 0, subjectIdx: 0, teacherIdx: 0 }, // Grade 10A - Math - John
    { classIdx: 0, subjectIdx: 1, teacherIdx: 1 }, // Grade 10A - English - Sarah
    { classIdx: 0, subjectIdx: 2, teacherIdx: 2 }, // Grade 10A - Science - Michael
    { classIdx: 1, subjectIdx: 0, teacherIdx: 0 }, // Grade 10B - Math - John
    { classIdx: 1, subjectIdx: 1, teacherIdx: 1 }, // Grade 10B - English - Sarah
    { classIdx: 2, subjectIdx: 5, teacherIdx: 2 }, // Grade 11A - Physics - Michael
    { classIdx: 2, subjectIdx: 7, teacherIdx: 3 }, // Grade 11A - CS - Emily
    { classIdx: 3, subjectIdx: 6, teacherIdx: 2 }, // Grade 12A - Chemistry - Michael
  ];

  for (const csm of classSubjectMap) {
    await prisma.classSubject.upsert({
      where: { classId_subjectId: { classId: classes[csm.classIdx].id, subjectId: subjects[csm.subjectIdx].id } },
      update: {},
      create: {
        classId: classes[csm.classIdx].id,
        subjectId: subjects[csm.subjectIdx].id,
        teacherId: teachers[csm.teacherIdx].id,
      },
    });
  }
  console.log("✅ Class-subject assignments created");

  // ─── 8. Students ──────────────────────────────────
  const studentPw = await bcrypt.hash("Student@123", 12);
  const studentData = [
    { email: "alice.johnson@student.school.edu", firstName: "Alice", lastName: "Johnson", studentId: "STU-001", classIdx: 0 },
    { email: "bob.williams@student.school.edu", firstName: "Bob", lastName: "Williams", studentId: "STU-002", classIdx: 0 },
    { email: "carol.miller@student.school.edu", firstName: "Carol", lastName: "Miller", studentId: "STU-003", classIdx: 1 },
    { email: "david.wilson@student.school.edu", firstName: "David", lastName: "Wilson", studentId: "STU-004", classIdx: 1 },
    { email: "eve.taylor@student.school.edu", firstName: "Eve", lastName: "Taylor", studentId: "STU-005", classIdx: 2 },
  ];

  const students = await Promise.all(
    studentData.map(async (s) => {
      const user = await prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: {
          email: s.email,
          passwordHash: studentPw,
          role: Role.STUDENT,
          firstName: s.firstName,
          lastName: s.lastName,
          gender: Gender.FEMALE,
          isEmailVerified: true,
        },
      });
      return prisma.student.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          studentId: s.studentId,
          classId: classes[s.classIdx].id,
          admissionDate: new Date("2024-09-01"),
          address: "123 Main Street",
          city: "Springfield",
          guardianName: "Parent Guardian",
          guardianPhone: "+1234567890",
        },
      });
    })
  );
  console.log("✅ Students created:", students.length);

  // ─── 9. Parent Users ──────────────────────────────
  const parentPw = await bcrypt.hash("Parent@123", 12);
  const parentUser = await prisma.user.upsert({
    where: { email: "parent@school.edu" },
    update: {},
    create: {
      email: "parent@school.edu",
      passwordHash: parentPw,
      role: Role.PARENT,
      firstName: "Robert",
      lastName: "Johnson",
      isEmailVerified: true,
    },
  });
  const parent = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: { userId: parentUser.id, occupation: "Engineer", address: "123 Main Street" },
  });

  // Link parent to first student (Alice)
  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: students[0].id } },
    update: {},
    create: { parentId: parent.id, studentId: students[0].id, relation: "FATHER" },
  });
  console.log("✅ Parent created and linked: parent@school.edu / Parent@123");

  // ─── 10. Timetable ────────────────────────────────
  const timetable = await prisma.timetable.create({
    data: {
      academicYearId: academicYear.id,
      effectiveFrom: new Date("2024-09-01"),
      isActive: true,
    },
  });

  const slots = [
    { classIdx: 0, subjectIdx: 0, teacherIdx: 0, day: DayOfWeek.MONDAY, start: "08:00", end: "09:00", room: "101" },
    { classIdx: 0, subjectIdx: 1, teacherIdx: 1, day: DayOfWeek.MONDAY, start: "09:00", end: "10:00", room: "102" },
    { classIdx: 0, subjectIdx: 2, teacherIdx: 2, day: DayOfWeek.TUESDAY, start: "08:00", end: "09:00", room: "Lab1" },
    { classIdx: 0, subjectIdx: 0, teacherIdx: 0, day: DayOfWeek.WEDNESDAY, start: "10:00", end: "11:00", room: "101" },
    { classIdx: 0, subjectIdx: 1, teacherIdx: 1, day: DayOfWeek.THURSDAY, start: "08:00", end: "09:00", room: "102" },
  ];

  for (const slot of slots) {
    await prisma.timetableSlot.create({
      data: {
        timetableId: timetable.id,
        classId: classes[slot.classIdx].id,
        subjectId: subjects[slot.subjectIdx].id,
        teacherId: teachers[slot.teacherIdx].id,
        dayOfWeek: slot.day,
        startTime: slot.start,
        endTime: slot.end,
        roomNumber: slot.room,
      },
    });
  }
  console.log("✅ Timetable created");

  // ─── 11. Fee Structures ───────────────────────────
  await prisma.feeStructure.createMany({
    data: [
      { name: "Annual Tuition Fee - Grade 10", type: FeeType.TUITION, amount: 1500, isRecurring: false },
      { name: "Monthly Transport Fee", type: FeeType.TRANSPORT, amount: 50, isRecurring: true, recurringMonths: [9, 10, 11, 12, 1, 2, 3, 4, 5] },
      { name: "Annual Library Fee", type: FeeType.LIBRARY, amount: 25, isRecurring: false },
      { name: "Exam Fee", type: FeeType.EXAM, amount: 75, isRecurring: false },
    ],
    skipDuplicates: true,
  });
  console.log("✅ Fee structures created");

  // ─── 12. Sample Books ─────────────────────────────
  await prisma.book.createMany({
    data: [
      { title: "Introduction to Algebra", author: "James Stewart", isbn: "978-0-321-48226-9", category: "Mathematics", totalCopies: 5, availableCopies: 5, publisher: "Pearson", publishYear: 2020 },
      { title: "English Grammar in Use", author: "Raymond Murphy", isbn: "978-1-108-45765-9", category: "English", totalCopies: 8, availableCopies: 8, publisher: "Cambridge", publishYear: 2019 },
      { title: "Physics: Principles & Problems", author: "Paul Zitzewitz", isbn: "978-0-07-845813-2", category: "Physics", totalCopies: 4, availableCopies: 4, publisher: "McGraw-Hill", publishYear: 2021 },
      { title: "A Brief History of Time", author: "Stephen Hawking", isbn: "978-0-553-38016-3", category: "Science", totalCopies: 3, availableCopies: 3, publisher: "Bantam", publishYear: 2018 },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "978-0-7432-7356-5", category: "Literature", totalCopies: 6, availableCopies: 6, publisher: "Scribner", publishYear: 2004 },
    ],
    skipDuplicates: true,
  });
  console.log("✅ Books created");

  // ─── 13. Vehicles & Routes ────────────────────────
  const vehicle = await prisma.vehicle.create({
    data: {
      registrationNo: "BUS-001",
      model: "Ford Transit",
      capacity: 40,
      driverName: "James Driver",
      driverPhone: "+1234567890",
    },
  });

  await prisma.transportRoute.create({
    data: {
      name: "Route A - North",
      vehicleId: vehicle.id,
      startPoint: "School",
      endPoint: "North District",
      stops: JSON.stringify([
        { name: "Main Street", time: "07:30", lat: 40.7128, lng: -74.006 },
        { name: "Park Avenue", time: "07:45", lat: 40.7589, lng: -73.9851 },
        { name: "School Gate", time: "08:00", lat: 40.785, lng: -73.9654 },
      ]),
    },
  });
  console.log("✅ Transport route created");

  // ─── 14. Announcement ─────────────────────────────
  await prisma.announcement.create({
    data: {
      title: "Welcome to the 2024-2025 Academic Year!",
      content: "We are pleased to welcome all students and staff to the new academic year. Please review your schedules and contact your class teacher with any questions.",
      authorId: admin.id,
      targetRoles: [Role.STUDENT, Role.PARENT, Role.TEACHER],
      isPinned: true,
    },
  });
  console.log("✅ Welcome announcement created");

  // ─── 15. Notification Preferences ────────────────
  const allUsers = [admin, ...teachers.map((t) => ({ id: t.userId })), ...students.map((s) => ({ id: s.userId })), { id: parentUser.id }];
  await Promise.all(
    allUsers.map((u) =>
      prisma.notificationPreference.upsert({
        where: { userId: u.id },
        update: {},
        create: { userId: u.id, email: true, sms: false, push: true, inApp: true },
      })
    )
  );
  console.log("✅ Notification preferences created");

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  SEED COMPLETE — Demo Credentials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Admin    : admin@school.edu       / Admin@123
  Teacher  : john.smith@school.edu  / Teacher@123
  Student  : alice.johnson@student.school.edu / Student@123
  Parent   : parent@school.edu      / Parent@123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
