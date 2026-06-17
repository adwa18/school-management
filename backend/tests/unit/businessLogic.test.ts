// tests/unit/gradeCalculation.test.ts
// Unit tests for core business logic — grade calculation

describe("Grade Calculation", () => {
  // Grade scale: A+=97-100, A=93-97, B=83-87, C=73-77, D=60-70, F=0-60

  const calculateGrade = (marksObtained: number, totalMarks: number) => {
    const percentage = (marksObtained / totalMarks) * 100;
    if (percentage >= 97) return { grade: "A+", gpa: 4.0 };
    if (percentage >= 93) return { grade: "A", gpa: 4.0 };
    if (percentage >= 90) return { grade: "A-", gpa: 3.7 };
    if (percentage >= 87) return { grade: "B+", gpa: 3.3 };
    if (percentage >= 83) return { grade: "B", gpa: 3.0 };
    if (percentage >= 80) return { grade: "B-", gpa: 2.7 };
    if (percentage >= 77) return { grade: "C+", gpa: 2.3 };
    if (percentage >= 73) return { grade: "C", gpa: 2.0 };
    if (percentage >= 70) return { grade: "C-", gpa: 1.7 };
    if (percentage >= 60) return { grade: "D", gpa: 1.0 };
    return { grade: "F", gpa: 0.0 };
  };

  const calculateGPA = (grades: { grade: string; creditHours: number }[]) => {
    const gradePoints: Record<string, number> = {
      "A+": 4.0, A: 4.0, "A-": 3.7,
      "B+": 3.3, B: 3.0, "B-": 2.7,
      "C+": 2.3, C: 2.0, "C-": 1.7,
      D: 1.0, F: 0.0,
    };
    const totalCredits = grades.reduce((s, g) => s + g.creditHours, 0);
    if (totalCredits === 0) return 0;
    const weightedSum = grades.reduce((s, g) => s + (gradePoints[g.grade] ?? 0) * g.creditHours, 0);
    return Math.round((weightedSum / totalCredits) * 100) / 100;
  };

  describe("Letter grade from percentage", () => {
    it("assigns A+ for 97–100%", () => {
      expect(calculateGrade(97, 100).grade).toBe("A+");
      expect(calculateGrade(100, 100).grade).toBe("A+");
    });

    it("assigns A for 93–96.99%", () => {
      expect(calculateGrade(93, 100).grade).toBe("A");
      expect(calculateGrade(96, 100).grade).toBe("A");
    });

    it("assigns B for 83–86.99%", () => {
      expect(calculateGrade(83, 100).grade).toBe("B");
      expect(calculateGrade(86, 100).grade).toBe("B");
    });

    it("assigns F for below 60%", () => {
      expect(calculateGrade(59, 100).grade).toBe("F");
      expect(calculateGrade(0, 100).grade).toBe("F");
    });

    it("handles non-100 total marks correctly", () => {
      expect(calculateGrade(45, 50).grade).toBe("A+"); // 90% = A-
      expect(calculateGrade(30, 50).grade).toBe("D");  // 60% = D
    });
  });

  describe("GPA calculation", () => {
    it("calculates correct GPA for perfect scores", () => {
      const grades = [
        { grade: "A+", creditHours: 4 },
        { grade: "A", creditHours: 3 },
      ];
      expect(calculateGPA(grades)).toBe(4.0);
    });

    it("calculates weighted GPA correctly", () => {
      const grades = [
        { grade: "A", creditHours: 4 },   // 4.0 × 4 = 16
        { grade: "B", creditHours: 3 },   // 3.0 × 3 = 9
        { grade: "C", creditHours: 2 },   // 2.0 × 2 = 4
      ];
      // Total: 29 / 9 = 3.22
      expect(calculateGPA(grades)).toBe(3.22);
    });

    it("returns 0 GPA when no grades", () => {
      expect(calculateGPA([])).toBe(0);
    });

    it("calculates GPA with failing grade", () => {
      const grades = [
        { grade: "A", creditHours: 3 },   // 4.0 × 3 = 12
        { grade: "F", creditHours: 3 },   // 0.0 × 3 = 0
      ];
      // Total: 12 / 6 = 2.00
      expect(calculateGPA(grades)).toBe(2.0);
    });
  });
});

// tests/unit/attendanceAggregation.test.ts
describe("Attendance Aggregation", () => {
  type AttendanceRecord = { status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; date: string };

  const aggregateAttendance = (records: AttendanceRecord[]) => {
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    records.forEach((r) => { counts[r.status]++; });
    const total = records.length;
    const attended = counts.PRESENT + counts.LATE;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
    return { ...counts, total, attendanceRate: rate, isAtRisk: rate < 75 };
  };

  it("calculates 100% attendance correctly", () => {
    const records = Array(20).fill({ status: "PRESENT", date: "2024-01-01" });
    const result = aggregateAttendance(records);
    expect(result.attendanceRate).toBe(100);
    expect(result.isAtRisk).toBe(false);
  });

  it("marks student at-risk when attendance < 75%", () => {
    const records = [
      ...Array(7).fill({ status: "PRESENT", date: "2024-01-01" }),
      ...Array(3).fill({ status: "ABSENT", date: "2024-01-02" }),
    ];
    const result = aggregateAttendance(records);
    expect(result.attendanceRate).toBe(70);
    expect(result.isAtRisk).toBe(true);
  });

  it("counts LATE as attended", () => {
    const records = [
      ...Array(8).fill({ status: "PRESENT", date: "2024-01-01" }),
      ...Array(2).fill({ status: "LATE", date: "2024-01-02" }),
    ];
    const result = aggregateAttendance(records);
    expect(result.attendanceRate).toBe(100);
    expect(result.LATE).toBe(2);
  });

  it("does not count EXCUSED as attended for rate", () => {
    const records = [
      ...Array(8).fill({ status: "PRESENT", date: "2024-01-01" }),
      ...Array(2).fill({ status: "EXCUSED", date: "2024-01-02" }),
    ];
    const result = aggregateAttendance(records);
    // 8 attended / 10 total = 80%
    expect(result.attendanceRate).toBe(80);
    expect(result.isAtRisk).toBe(false);
  });

  it("returns 0% rate for empty records", () => {
    const result = aggregateAttendance([]);
    expect(result.attendanceRate).toBe(0);
    expect(result.total).toBe(0);
  });
});

// tests/unit/feeCalculation.test.ts
describe("Fee Calculation", () => {
  const applyLateFee = (amount: number, daysOverdue: number, fineRate = 0.005) => {
    if (daysOverdue <= 0) return amount;
    const fine = amount * fineRate * daysOverdue;
    return Math.round((amount + fine) * 100) / 100;
  };

  const calculateInvoiceTotal = (items: { amount: number; quantity: number }[], taxRate = 0) => {
    const subtotal = items.reduce((s, i) => s + i.amount * i.quantity, 0);
    const tax = subtotal * taxRate;
    return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
  };

  it("no late fee when on time", () => {
    expect(applyLateFee(1000, 0)).toBe(1000);
    expect(applyLateFee(1000, -1)).toBe(1000);
  });

  it("calculates 0.5%/day late fee correctly", () => {
    expect(applyLateFee(1000, 10)).toBe(1050); // 1000 * 0.005 * 10 = 50
  });

  it("calculates invoice with zero tax", () => {
    const items = [{ amount: 500, quantity: 1 }, { amount: 50, quantity: 2 }];
    const result = calculateInvoiceTotal(items);
    expect(result.subtotal).toBe(600);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(600);
  });

  it("calculates invoice with tax", () => {
    const items = [{ amount: 100, quantity: 3 }];
    const result = calculateInvoiceTotal(items, 0.1); // 10% tax
    expect(result.subtotal).toBe(300);
    expect(result.tax).toBe(30);
    expect(result.total).toBe(330);
  });
});
